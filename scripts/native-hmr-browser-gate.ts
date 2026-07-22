import { join } from "node:path";
import { writeFile } from "node:fs/promises";

const repoRoot = join(import.meta.dir, "..");
const fixtureRoot = join(repoRoot, "tests", "fixtures", "builder-native-hmr");
const appPath = join(fixtureRoot, "App.svelte");
const probePath = join(fixtureRoot, "hmr-probe.ts");
const sessionName = `native-hmr-gate-${process.pid}`;

const assert = (condition: boolean, message: string): void => {
    if (!condition) throw new Error(message);
};

const readFirstLine = async (stream: ReadableStream<Uint8Array>): Promise<string> => {
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    try {
        while (true) {
            const chunk = await reader.read();
            if (chunk.done) throw new Error("Native HMR fixture exited before reporting a port.");
            buffer += decoder.decode(chunk.value, { stream: true });
            const newline = buffer.indexOf("\n");
            if (newline === -1) continue;
            return buffer.slice(0, newline).trim();
        }
    } finally {
        reader.releaseLock();
    }
};

const runPlaywright = async (args: string[]): Promise<string> => {
    const child = Bun.spawn(["playwright-cli", `-s=${sessionName}`, ...args], {
        stderr: "pipe",
        stdout: "pipe",
    });
    const [stdout, stderr] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text()]);
    const exitCode = await child.exited;
    if (exitCode !== 0) {
        throw new Error(`playwright-cli failed (${exitCode}): ${stderr || stdout}`);
    }

    return stdout.trim();
};

const parseRawValue = <T>(output: string): T => {
    let parsed: unknown;
    try {
        parsed = JSON.parse(output);
    } catch {
        return output as T;
    }

    if (typeof parsed !== "string") return parsed as T;

    try {
        return JSON.parse(parsed) as T;
    } catch {
        return parsed as T;
    }
};

const evaluate = async <T>(source: string): Promise<T> =>
    parseRawValue<T>(await runPlaywright(["--raw", "eval", source]));

const runCode = async <T>(source: string): Promise<T> =>
    parseRawValue<T>(await runPlaywright(["--raw", "run-code", source]));

const originalApp = await Bun.file(appPath).text();
const originalProbe = await Bun.file(probePath).text();
let fixtureServer: ReturnType<typeof Bun.spawn> | undefined;
let browserOpened = false;

try {
    fixtureServer = Bun.spawn([process.execPath, join(fixtureRoot, "server.ts")], {
        cwd: repoRoot,
        stderr: "pipe",
        stdin: "pipe",
        stdout: "pipe",
    });
    if (!(fixtureServer.stdout instanceof ReadableStream)) {
        throw new Error("Native HMR fixture stdout is not readable.");
    }

    const portLine = await readFirstLine(fixtureServer.stdout);
    const portValue = (JSON.parse(portLine) as { port?: unknown }).port;
    assert(typeof portValue === "number" && portValue > 0, `Invalid native HMR fixture port: ${portLine}`);

    await runPlaywright(["open", `http://127.0.0.1:${portValue}`]);
    browserOpened = true;

    const initial = await evaluate<{ boots: number; hasSse: boolean; text: string; title: string }>(
        "JSON.stringify({ boots: globalThis.__nativeHmrBoots ?? 0, hasSse: document.documentElement.outerHTML.includes('___live_reload'), text: document.querySelector('[data-native-hmr]')?.textContent ?? '', title: document.title })",
    );
    assert(initial.title === "Native HMR Probe", `Unexpected initial title: ${initial.title}`);
    assert(initial.text === "native-v3", `Unexpected initial module value: ${initial.text}`);
    assert(initial.boots === 1, `Unexpected initial boot count: ${initial.boots}`);
    assert(!initial.hasSse, "Native browser gate unexpectedly used the SSE fallback.");

    await evaluate(
        "(() => { sessionStorage.setItem('nativeHmrReloads','0'); addEventListener('beforeunload', () => sessionStorage.setItem('nativeHmrReloads', String(Number(sessionStorage.getItem('nativeHmrReloads') || '0') + 1))); return 'armed'; })()",
    );

    const nextProbe = originalProbe.replace('"native-v3"', '"native-script-hmr"');
    assert(nextProbe !== originalProbe, "Native HMR fixture probe did not contain the expected baseline value.");
    await writeFile(probePath, nextProbe, "utf8");
    const moduleUpdate = await runCode<{ boots: number; reloads: string | null; text: string }>(
        "async page => { await page.waitForFunction(() => document.querySelector('[data-native-hmr]')?.textContent === 'native-script-hmr', null, { timeout: 5000 }); return await page.evaluate(() => JSON.stringify({ boots: globalThis.__nativeHmrBoots ?? 0, reloads: sessionStorage.getItem('nativeHmrReloads'), text: document.querySelector('[data-native-hmr]')?.textContent ?? '' })); }",
    );
    assert(moduleUpdate.text === "native-script-hmr", `Module HMR did not update the DOM: ${moduleUpdate.text}`);
    assert(moduleUpdate.boots === 1, `Module HMR remounted the app: ${moduleUpdate.boots}`);
    assert(moduleUpdate.reloads === "0", `Module HMR triggered a full reload: ${moduleUpdate.reloads}`);

    const nextApp = originalApp.replace("rgb(10, 20, 30)", "rgb(40, 50, 60)");
    assert(nextApp !== originalApp, "Native HMR fixture did not contain the expected baseline CSS value.");
    await writeFile(appPath, nextApp, "utf8");
    const cssUpdate = await runCode<{ boots: number; color: string; reloads: string | null }>(
        "async page => { await page.waitForFunction(() => getComputedStyle(document.querySelector('[data-native-hmr]')).color === 'rgb(40, 50, 60)', null, { timeout: 5000 }); return await page.evaluate(() => JSON.stringify({ boots: globalThis.__nativeHmrBoots ?? 0, color: getComputedStyle(document.querySelector('[data-native-hmr]')).color, reloads: sessionStorage.getItem('nativeHmrReloads') })); }",
    );
    assert(cssUpdate.color === "rgb(40, 50, 60)", `CSS HMR did not update the computed color: ${cssUpdate.color}`);
    assert(cssUpdate.boots === 2, `CSS HMR did not remount the accepted component exactly once: ${cssUpdate.boots}`);
    assert(cssUpdate.reloads === "0", `CSS HMR triggered a full reload: ${cssUpdate.reloads}`);

    const consoleOutput = await runPlaywright(["console"]);
    assert(consoleOutput.includes("Errors: 0"), `Native HMR browser console reported errors:\n${consoleOutput}`);

    console.log(JSON.stringify({ css: cssUpdate.color, module: moduleUpdate.text, reloads: cssUpdate.reloads }));
} finally {
    await writeFile(appPath, originalApp, "utf8");
    await writeFile(probePath, originalProbe, "utf8");

    if (browserOpened) {
        await runPlaywright(["close"]).catch(() => undefined);
    }

    if (fixtureServer !== undefined) {
        fixtureServer.stdin?.write("\n");
        fixtureServer.stdin?.end();
        await fixtureServer.exited;
    }
}
