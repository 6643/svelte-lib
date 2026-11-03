import { svelte } from "@sveltejs/vite-plugin-svelte";
import { defineConfig } from "vite-plus";

export default defineConfig({
  // root 改成 demo/ 后, 插件不再自动找到仓库根的 svelte.config.js, 显式指定
  plugins: [svelte({ configFile: new URL("./svelte.config.js", import.meta.url).pathname })],

  // 演示站入口在 demo/, 由它作为 dev server 与 build 的根;
  // 库源码仍按相对路径引用 (src/ 在仓库根, 因此用 ../src)
  root: "demo",

  // 演示站产物放到根目录的 build/, 库产物 dist/ 由 svelte-package 生成, 两者互不覆盖
  build: { outDir: "../build", emptyOutDir: true },

  // svelte 的 browser 条件缺省不会命中, 命中 server 版会让 mount 直接抛错
  resolve: { conditions: ["browser"] },

  test: {
    // root 已改成 demo/, 测试与 setup 都在仓库根, 因此路径要显式指回上一级
    root: ".",
    environment: "happy-dom",
    include: ["src/**/*.test.ts", "demo/**/*.test.ts"],
    setupFiles: ["test/setup.ts"],
  },

  lint: {
    ignorePatterns: ["dist/**", "build/**"],
    options: { typeAware: true, typeCheck: true },
  },

  fmt: {
    ignorePatterns: ["dist/**", "build/**"],
  },
});
