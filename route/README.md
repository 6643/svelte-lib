# svelte-route

A lightweight Bun-only SPA router for Svelte projects.

## Features

- Standalone package with a Bun-first workflow
- Declarative `<Route>` API
- Exact path matching with `*` fallback routes
- Query decoder props with `$name` syntax
- Programmatic navigation helpers
- Browser back/forward synchronization
- Lazy-loaded route components

## Install

```bash
bun add ../svelte-route
```

This repository is currently configured as a private package.
Use a local path or workspace dependency, then import from `svelte-route` as usual.

## Quick Start

```svelte
<script lang="ts">
  import { Route } from 'svelte-route';

  import Home from './routes/Home.svelte';
  import User from './routes/User.svelte';
  import NotFound from './routes/NotFound.svelte';
</script>

<Route path="/" component={Home} />
<Route path="/user" component={User} $id={Number} />
<Route path="*" component={NotFound} />
```

For `/user?id=7`, the `User` component receives:

```ts
{
  id: 7
}
```

## Route API

`Route` accepts:

- `path`: exact pathname to match, or `*` for a fallback route
- `component`: a Svelte component or an explicit `lazyRoute(...)` definition
- `$name`: an optional query decoder that maps `?name=value` to a prop named `name`

Matching behavior:

- When multiple routes share the same exact `path`, the last registered route wins
- If no exact route matches, the last registered `path="*"` route wins
- Query strings do not affect route matching
- Route configuration is treated as immutable after mount
- `path` must be `*` or an absolute pathname without query, hash, `.` or `..` segments

## Query Decoder Props

Built-in decoders:

- `String`
- `Number`
- `Boolean`

Custom decoders are also supported:

```svelte
<script lang="ts">
  import { Route } from 'svelte-route';

  import Search from './routes/Search.svelte';

  const parseTags = (raw: string | null) => raw?.split(',').filter(Boolean);
</script>

<Route
  path="/search"
  component={Search}
  $page={Number}
  $enabled={Boolean}
  $tags={parseTags}
/>
```

For `/search?page=2&enabled=true&tags=red,blue`, `Search` receives:

```ts
{
  page: 2,
  enabled: true,
  tags: ['red', 'blue']
}
```

Decoder behavior:

- Missing query keys become `undefined`
- Invalid `Number` and `Boolean` values become `undefined`
- Duplicate query keys use the first value
- Exceptions thrown by custom decoders bubble up

Defensive decoder guidance:

- Treat query input as untrusted data
- Decoders receive the decoded string value or `null`
- Prefer pure decoders with no side effects
- Return `undefined` for invalid input when possible instead of throwing
- Avoid expensive parsing work on unbounded input

## Navigation Helpers

```ts
import {
  routeBackPath,
  routeCurrentPath,
  routeForwardPath,
  routePush,
  routeReplace
} from 'svelte-route';

routePush('/user?id=1');
routePush('?page=2');
routeReplace('https://app.test/user?id=3');

const current = routeCurrentPath();
const back = routeBackPath();
const forward = routeForwardPath();
```

Supported navigation inputs:

- Absolute app paths such as `/user?id=1`
- Query-only updates such as `?page=2`
- Same-origin absolute URLs

Navigation behavior:

- `routePush()` appends a new history entry
- `routeReplace()` rewrites the current history entry
- Navigating to the current normalized path is a no-op
- Hash-only navigation targets are ignored as no-ops
- Browser back/forward keeps route rendering and helper outputs in sync
- Native same-document `history.pushState()` and `history.replaceState()` calls are synchronized into router state
- Router-managed back/forward hints are bounded to the most recent 100 managed entries
- Query-only updates preserve the current hash fragment

Invalid navigation inputs throw:

- `foo`
- `./foo`
- `../foo`
- `//elsewhere.test/path`
- same-origin absolute URLs whose pathname begins with `//`
- any absolute cross-origin URL

## Lazy Routes

`component` also accepts an explicit lazy route definition created with `lazyRoute(...)`.

```svelte
<script lang="ts">
  import { Route, lazyRoute } from 'svelte-route';

  const loadSettings = () => import('./routes/Settings.svelte');
</script>

<Route path="/settings" component={lazyRoute(loadSettings)} />
```

Lazy route behavior:

- No default loading UI is rendered while the loader is pending
- The resolved module's `default` export is rendered
- Loader errors are thrown upward
- A pending lazy load is reused if the route is deactivated and reactivated before resolution
- After a lazy load failure, leaving and re-entering the route allows a fresh retry
- `lazyRoute(...)` must receive a zero-argument loader function that returns a promise
- The resolved module must expose a function-valued `default` component export
- Bare zero-argument loaders are not supported; wrap them in `lazyRoute(...)`

## Limits

- Client-side SPA routing only
- Browser environment required
- Router-managed history metadata is scoped to the current runtime session; stale or foreign managed state is repaired to the current path
- Dynamic route params are not included
- Nested routes are not included
- Anchor interception is not included
- Hash fragments are not part of route matching semantics, and hash fragments passed in navigation targets are ignored

## Development

```bash
bun install
bun test
bun run typecheck
```

Development metadata notes:

- Repository `devDependencies` are pinned to exact versions for reproducible local verification
- Library `peerDependencies` stay on compatibility ranges so consuming apps are not locked to one exact patch
