# Aggressive Latest Modernization Design

## Background

The repository is already on current package versions, but a significant portion of the codebase still uses older Svelte 5-compatible patterns instead of the newest official style. The user explicitly wants an aggressive modernization pass and accepts breaking changes.

This design treats the work as repository-wide modernization, not a minimal compatibility migration.

## Source Basis

Primary guidance comes from the current official Svelte documentation:

- Svelte 5 migration guide: <https://svelte.dev/docs/svelte/v5-migration-guide>
- `$props`: <https://svelte.dev/docs/svelte/$props>
- `$derived`: <https://svelte.dev/docs/svelte/$derived>
- `$effect`: <https://svelte.dev/docs/svelte/$effect>
- `onMount`: <https://svelte.dev/docs/svelte/svelte#onMount>

Tooling guidance remains aligned with current Bun and repository conventions:

- Bun TypeScript/runtime docs: <https://bun.sh/docs/runtime/typescript>
- Bun package manager docs: <https://bun.sh/docs/pm/cli/install>

## Goal

Aggressively modernize the repository so that both runtime code and supporting tests/docs use the newest official patterns wherever reasonably possible, even when that causes breaking changes to internal structure, examples, and non-runtime usage patterns.

## User-Approved Breaking Change Policy

Breaking changes are allowed for:

1. internal file layout
2. test paths
3. fixtures and helper module names
4. documentation examples
5. component-internal implementation patterns

The implementation should still avoid unnecessary public runtime breakage when a modernized internal implementation can preserve the same outward behavior.

## Non-Goals

1. Do not rewrite the builder core purely for aesthetic consistency if doing so risks working build/dev behavior.
2. Do not change package-level public exports unless the modernization requires it.
3. Do not introduce new frameworks or unrelated abstractions.

## Modernization Standard

### Svelte Rules

Treat these as legacy and remove them from actively maintained code where practical:

- `export let`
- `$:`
- `on:...`
- `<slot>` / `slot=...`

Preferred replacements:

- `$props`
- `$state`
- `$derived`
- `$effect`
- event attributes
- snippets / `@render`

### Lifecycle Rule

`onMount` is not itself legacy according to the docs, but under this aggressive policy it should be replaced with `$effect` / `$effect.pre` when the semantics are equivalent and the result is cleaner. If a specific use of `onMount` remains, it must be because the modernized alternative would materially reduce clarity or correctness.

### TypeScript Rule

Use explicit types where modernized code would otherwise become ambiguous. Avoid adding vague `any` or preserving old broad typings out of convenience.

## Module Prioritization

### Phase 1: `ui`

`ui` is the first modernization layer because it contains the largest concentration of legacy component patterns while also having strong regression coverage.

Modernization target:

- eliminate `export let`
- eliminate `$:`
- keep event attributes and snippet usage as the only supported patterns
- move component code toward consistent rune-style internals

### Phase 2: `route`

`route` is second because it is behaviorally important and already partially modernized. Tests, fixtures, and helpers should be upgraded alongside the runtime code to avoid mixed paradigms.

### Phase 3: `builder`

`builder` is last because it has the most operational risk. The modernization rule here is "latest official style where practical, runtime safety first."

## Current Legacy Findings

Within `ui`, the following current patterns remain:

- `export let` remains in component files such as:
  - `ui/Block.svelte`
  - `ui/Button.filled.svelte`
  - `ui/Button.icon.svelte`
  - `ui/Button.text.svelte`
  - `ui/Input.string.svelte`
  - `ui/Input.range.svelte`
  - `ui/Modal.filled.svelte`
  - `ui/Plyr.svelte`
  - `ui/Swiper.svelte`
- `$:` remains in:
  - `ui/Input.string.svelte`
  - `ui/Input.range.svelte`
  - `ui/Modal.filled.svelte`
  - `ui/Swiper.svelte`

These are the primary confirmed modernization targets.

## Design Approach

Use a layered modernization pass:

1. modernize one domain at a time
2. keep each phase verifiable on its own
3. accept structural and test-path breakage where it simplifies the codebase
4. retain builder runtime behavior as a hard constraint

## Breaking Change Inventory

### UI

- component internals switch to `$props`, `$derived`, `$effect`, `$state`
- old internal prop/default-value and reactive expression patterns are removed
- docs and examples no longer preserve legacy compatibility language

### Route

- test fixtures and helpers may change names and locations
- route-supporting component patterns may change to match runes-first style

### Builder

- documentation and local workflow descriptions continue moving toward root-level script usage and current conventions
- any removable legacy style in builder-support code should be removed unless it threatens runtime stability

## Validation Strategy

Each phase must end with fresh verification:

```bash
bun run test
bun run typecheck
```

When builder-facing behavior is touched, also run:

```bash
bun run builder:build
```

## Success Criteria

The modernization is complete when:

1. the targeted legacy Svelte patterns are removed from actively maintained code in scope
2. tests and helpers no longer preserve outdated implementation styles unnecessarily
3. the repository continues to pass verification commands
4. builder still functions despite aggressive modernization elsewhere
