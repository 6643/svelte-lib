# Top Level Demo Design

## Background

The repository currently exposes a single-package, multi-entry layout rooted at top-level capability directories:

- `ui/`
- `use/`
- `route/`
- `builder/`

Those directories are not just source placement. They are part of the repository's public package structure and documentation model:

- [`package.json`](/._/svelte-lib/package.json) exports `./ui`, `./use`, `./route`, and `./builder`
- [`README.md`](/._/svelte-lib/README.md) describes those directories as the package's public capability areas
- [`tests/bun-latest-api.test.ts`](/._/svelte-lib/tests/bun-latest-api.test.ts) asserts parts of the current repository layout directly

The user wants to add a complete outward-facing sample application at the repository top level, but does not want that sample to feel like an accidental fifth public subsystem.

## Goals

1. Add one complete demo application at the repository top level.
2. Keep the current public package boundary centered on `ui/`, `use/`, `route/`, and `builder/`.
3. Make the demo work as a real consumer project of `svelte-lib`, not as library-internal runtime code.
4. Preserve a clear distinction between publishable library source and non-publish demo assets.

## Non-Goals

1. Do not migrate repository source into a root `src/` tree.
2. Do not add `demo/` to package exports.
3. Do not move the demo under `builder/`, `ui/`, `route/`, or `use/`.
4. Do not turn this into a multi-example catalog in this task.

## Current Constraints

### Verified Facts

- [`package.json`](/._/svelte-lib/package.json) exports only `.`, `./ui`, `./use`, `./route`, and `./builder`.
- [`README.md`](/._/svelte-lib/README.md) describes the repository using those same top-level capability directories.
- [`builder/README.md`](/._/svelte-lib/builder/README.md) already assigns a strong meaning to `src/`: the application source tree inside a builder consumer project.
- [`builder/README.md`](/._/svelte-lib/builder/README.md) also states that this repository no longer ships a bundled builder demo project.
- [`tests/bun-latest-api.test.ts`](/._/svelte-lib/tests/bun-latest-api.test.ts) asserts that old builder-owned demo files are absent.

### Implication

Using a root `src/` directory for repository-wide reorganization would blur the meaning of `src/` that `builder` documentation already uses for consumer applications. Reintroducing a sample app under `builder/` would directly conflict with the recently simplified repository boundary.

## Chosen Approach

Add a top-level `demo/` directory and treat it as a self-contained consumer app.

Planned shape:

```text
demo/
  package.json
  builder.ts
  src/
    App.svelte
  assets/
```

The demo should import from the public package entry points, for example:

```ts
import { Block, FilledButton } from "svelte-lib/ui";
import { useTheme } from "svelte-lib/use";
import { Route, routePush } from "svelte-lib/route";
```

This keeps the repository architecture readable:

- `ui/`, `use/`, `route/`, `builder/`: published library capability boundaries
- `tests/`: repository verification
- `demo/`: non-published sample consumer app

## Alternatives Considered

### 1. Root `src/`

Rejected.

It would create a second, repository-level meaning for `src/` while `builder` already documents `src/` as the application tree of a consuming project. It also adds structural churn without improving the public API.

### 2. `examples/`

Reasonable, but not chosen.

`examples/` fits a repository with multiple long-lived example projects. The user explicitly wants one complete demo application, so `demo/` is more direct and lower-ceremony.

### 3. `builder/demo/`

Rejected.

The repository intentionally removed bundled builder demo files, and current tests assert that old builder-owned demos no longer exist.

## File Responsibilities

- `demo/package.json`: declare the sample app as a local consumer project that depends on `svelte-lib`
- `demo/builder.ts`: configure the sample app using the library's builder contract
- `demo/src/App.svelte`: top-level sample application demonstrating public imports
- `demo/assets/`: optional static assets used by the sample app
- `README.md`: document how to install and run the top-level demo without implying that `demo/` is a package export
- `tests/*`: add repository-level regression coverage that the demo exists as a top-level sample app while staying outside package exports

## Verification Strategy

The implementation should prove all of the following:

1. `demo/` exists as a complete app scaffold.
2. `demo/` is not exported from the root package.
3. The root repository tests still pass.
4. Type checking still passes.
5. The demo can be treated as a real builder app with `builder.ts` plus `src/App.svelte`.

## Risks

### Medium Risk

Adding a new top-level directory changes repository shape and may tempt future code to import from demo internals or accidentally treat the demo as part of the publishable package.

### Mitigations

- keep `demo/` out of `exports`
- add an explicit regression test for the demo boundary
- document demo commands separately from library package entry points

## Rollback

Rollback is straightforward because the demo is isolated:

1. delete `demo/`
2. remove the README demo section
3. remove the demo boundary regression test

No public package export changes are required for either rollout or rollback.
