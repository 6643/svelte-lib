import { defineSvelteConfig } from "../src/builder/_.ts";

export default defineSvelteConfig({
    appComponent: "src/App.svelte",
    appTitle: "Demo App",
    mountId: "app",
    assetsDirs: ["assets"],
    outDir: "dist",
    port: 3000,
});
