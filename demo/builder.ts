import { defineSvelteConfig } from "svelte-lib/builder";

export default defineSvelteConfig({
    appComponent: "src/App.svelte",
    appTitle: "svelte-lib demo",
    port: 3030,
});
