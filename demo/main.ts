import { mount } from "svelte";
import App from "./App.svelte";
// 与源实现的 demo 一致: 启动时把已存的主题模式/强调色应用到 DOM
import { initAccent, initTheme } from "#lib";

initTheme();
initAccent();

const target = document.getElementById("app");
if (!target) throw new Error("#app not found");

export default mount(App, { target });
