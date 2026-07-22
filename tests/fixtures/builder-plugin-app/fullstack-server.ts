import page from "./index.html";

const server = Bun.serve({
    development: { hmr: true },
    port: 0,
    routes: { "/": page },
});

try {
    const pageResponse = await fetch(new URL("/", server.url));
    const html = await pageResponse.text();
    const scriptPath = html.match(/<script[^>]+src="([^"]+)"/)?.[1];
    const stylesheetPath = html.match(/<link[^>]+href="([^"]+\.css[^"]*)"/)?.[1];
    const scriptResponse = scriptPath ? await fetch(new URL(scriptPath, server.url)) : null;
    const stylesheetResponse = stylesheetPath ? await fetch(new URL(stylesheetPath, server.url)) : null;
    const script = scriptResponse ? await scriptResponse.text() : "";

    console.log(
        JSON.stringify({
            cssStatus: stylesheetResponse?.status ?? null,
            development: server.development,
            hasCssInjection: script.includes("data-svelte-id"),
            hasCompiledComponent: script.includes("tests/fixtures/builder-plugin-app/App.svelte"),
            pageStatus: pageResponse.status,
            scriptStatus: scriptResponse?.status ?? null,
        }),
    );
} finally {
    server.stop(true);
}
