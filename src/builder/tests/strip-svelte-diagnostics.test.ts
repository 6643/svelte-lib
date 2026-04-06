import { afterEach, expect, test } from "bun:test";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { buildSvelte } from "../build";
import { stripSvelteDiagnosticsModule } from "../strip-svelte-diagnostics";

const tempDirs: string[] = [];

const createTempBuildProject = async (): Promise<string> => {
    const rootDir = join(
        process.cwd(),
        "src/builder/tests",
        `.tmp-strip-svelte-diagnostics-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    );
    tempDirs.push(rootDir);

    await mkdir(join(rootDir, "src"), { recursive: true });
    await writeFile(
        join(rootDir, "src/App.svelte"),
        `<script>
    let count = $state(0);
</script>

<button onclick={() => count++}>{count}</button>
`,
        "utf8",
    );

    return rootDir;
};

afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map((rootDir) => rm(rootDir, { recursive: true, force: true })));
});

test("stripSvelteDiagnosticsModule keeps export-star lines while replacing exported error functions", () => {
    const source = [
        "import { DEV } from 'esm-env';",
        "",
        "export * from '../shared/errors.js';",
        "",
        "export function first_issue(value) {",
        "    if (DEV) throw new Error(value);",
        "    throw new Error(value);",
        "}",
        "",
        "export function second_issue() {",
        "    throw new Error('second');",
        "}",
    ].join("\n");

    const output = stripSvelteDiagnosticsModule(source, "errors");

    expect(output.includes("export * from '../shared/errors.js';")).toBe(true);
    expect(output.includes('export function first_issue(value) { throw Error("first_issue"); }')).toBe(true);
    expect(output.includes('export function second_issue() { throw Error("second_issue"); }')).toBe(true);
    expect(output.includes("if (DEV)")).toBe(false);
});

test("buildSvelte strips diagnostics from shared Svelte runtime error modules", async () => {
    const rootDir = await createTempBuildProject();
    const result = await buildSvelte({
        appComponent: "src/App.svelte",
        outDir: ".build",
        rootDir,
        stripSvelteDiagnostics: true,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
        throw new Error(result.error);
    }

    const js = await readFile(join(result.value.outDir, result.value.jsFile), "utf8");

    expect(js.includes("https://svelte.dev/e/invariant_violation")).toBe(false);
    expect(js.includes("An invariant violation occurred")).toBe(false);
});
