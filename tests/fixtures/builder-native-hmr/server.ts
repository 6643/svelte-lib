import { join } from "node:path";

import { createNativeDevWorkspace, startNativeDevServer } from "../../../src/builder/native-dev";

const rootDir = import.meta.dir;
const workspace = await createNativeDevWorkspace({
    appComponentPath: join(rootDir, "App.svelte"),
    appTitle: "Native HMR Probe",
    assets: [],
    mountId: "app",
    packageRoot: process.cwd(),
    rootDir,
    sourceRoot: rootDir,
});

if (!workspace.ok) {
    console.error(workspace.error);
    process.exit(1);
}

const server = await startNativeDevServer(workspace.value, 0);
if (!server.ok) {
    console.error(server.error);
    process.exit(1);
}

console.log(JSON.stringify({ port: server.value.port }));
await new Promise<void>((resolve) => {
    process.stdin.once("data", () => resolve());
    process.stdin.resume();
});
await server.value.stop();
