# svelte-lib

单 `package.json` 多子路径导出：

- `svelte-lib`
- `svelte-lib/ui`
- `svelte-lib/use`
- `svelte-lib/route`
- `svelte-lib/builder`

其中：

- `ui/` 放可复用 Svelte 组件与图标
- `use/` 放 hooks 与轻量工具
- `route/` 承接原 `svelte-route`
- `builder/` 承接原 `svelte-builder`

CLI 继续保留：

```bash
svelte-builder build
svelte-builder dev
```
