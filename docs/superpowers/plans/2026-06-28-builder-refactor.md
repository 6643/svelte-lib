# Builder Refactoring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Eliminate code duplication between `build.ts` and `build-validate.ts`, extract plugins from `build.ts` to a dedicated file, and unify HTML shell generation.

**Architecture:** Extract three shared import-scanning functions to `import-utils.ts`; extract three Bun plugins (Svelte plugin, esm-env plugin, runtime alias plugin) to `build-plugins.ts`; unify `createHtmlShell` export from `build.ts`.

**Tech Stack:** TypeScript, Bun, Svelte 5 compiler

## Global Constraints

- All type signatures must be fully compatible with existing callers — no test breakage
- Public API exports from `build.ts` (e.g. `buildSvelte`, `runConfiguredBuild`, `createHtmlShell`) must remain unchanged
- Test coverage must not decrease — all existing tests must still pass
- `escapeHtml` is only used in `build.ts`, not in `build-validate.ts` — do not import it into `build-validate.ts`
- `compile` from `svelte/compiler` is only used in plugin code in `build.ts` — remove that import after plugins are extracted
- `stripSvelteDiagnosticsModule` is only used in plugin code in `build.ts` — remove that import after plugins are extracted

---

### Task 1: Create `import-utils.ts` with shared functions

**Files:**
- Create: `src/builder/import-utils.ts`
- Test: `src/builder/tests/import-utils.test.ts`

**Interfaces:**
- Produces: `skipQuotedString`, `skipWhitespaceAndComments`, `findUnsupportedDynamicImportExpression`, `escapeHtml`, `isIdentifierCharacter`, `isRelativeImportSpecifier`, `isLocalFileImportSpecifier`, `isPackageImportSpecifier`

- [ ] **Step 1: Run existing tests to confirm baseline**

```bash
cd /home/_/._/svelte-lib && bun test 2>&1 | tail -20
```
Expected: All tests pass

- [ ] **Step 2: Create `src/builder/import-utils.ts` with all 8 exported functions**

The functions (extracted verbatim from build.ts lines 80-240):
- `isRelativeImportSpecifier`
- `isLocalFileImportSpecifier`
- `isPackageImportSpecifier`
- `isIdentifierCharacter`
- `skipQuotedString`
- `skipWhitespaceAndComments`
- `findUnsupportedDynamicImportExpression`
- `escapeHtml`

```typescript
export const isRelativeImportSpecifier = (specifier: string): boolean =>
    specifier.startsWith("./") || specifier.startsWith("../");

export const isLocalFileImportSpecifier = (specifier: string): boolean =>
    specifier.startsWith("file:") || specifier.startsWith("/");

export const isPackageImportSpecifier = (specifier: string): boolean =>
    specifier.startsWith("#");

export const isIdentifierCharacter = (value: string | undefined): boolean =>
    value !== undefined && /[A-Za-z0-9_$]/.test(value);

export const skipQuotedString = (source: string, start: number, quote: "'" | '"'): number => {
    let index = start + 1;
    while (index < source.length) {
        if (source[index] === "\\") {
            index += 2;
            continue;
        }
        if (source[index] === quote) {
            return index + 1;
        }
        index += 1;
    }
    return index;
};

export const skipWhitespaceAndComments = (source: string, start: number): number => {
    let index = start;
    while (index < source.length) {
        if (/\s/.test(source[index] ?? "")) {
            index += 1;
            continue;
        }
        if (source[index] === "/" && source[index + 1] === "/") {
            index += 2;
            while (index < source.length && source[index] !== "\n") {
                index += 1;
            }
            continue;
        }
        if (source[index] === "/" && source[index + 1] === "*") {
            index += 2;
            while (index < source.length && !(source[index] === "*" && source[index + 1] === "/")) {
                index += 1;
            }
            index = Math.min(index + 2, source.length);
            continue;
        }
        break;
    }
    return index;
};

export const findUnsupportedDynamicImportExpression = (
    source: string,
    start = 0,
    stopCharacter?: string,
): { next: number; unsupported: boolean } => {
    let index = start;
    while (index < source.length) {
        const character = source[index];
        if (stopCharacter !== undefined && character === stopCharacter) {
            return { next: index + 1, unsupported: false };
        }
        if (character === "/" && source[index + 1] === "/") {
            index = skipWhitespaceAndComments(source, index);
            continue;
        }
        if (character === "/" && source[index + 1] === "*") {
            index = skipWhitespaceAndComments(source, index);
            continue;
        }
        if (character === "'" || character === '"') {
            index = skipQuotedString(source, index, character);
            continue;
        }
        if (character === "`") {
            index += 1;
            while (index < source.length) {
                if (source[index] === "\\") {
                    index += 2;
                    continue;
                }
                if (source[index] === "`") {
                    index += 1;
                    break;
                }
                if (source[index] === "$" && source[index + 1] === "{") {
                    const nested = findUnsupportedDynamicImportExpression(source, index + 2, "}");
                    if (nested.unsupported) return nested;
                    index = nested.next;
                    continue;
                }
                index += 1;
            }
            continue;
        }
        if (
            source.startsWith("import", index) &&
            !isIdentifierCharacter(source[index - 1]) &&
            !isIdentifierCharacter(source[index + "import".length])
        ) {
            let nextIndex = skipWhitespaceAndComments(source, index + "import".length);
            if (source[nextIndex] === "(") {
                nextIndex = skipWhitespaceAndComments(source, nextIndex + 1);
                const argumentStart = source[nextIndex];
                if (argumentStart === "'" || argumentStart === '"') {
                    index = skipQuotedString(source, nextIndex, argumentStart);
                    continue;
                }
                if (argumentStart === "`") {
                    return { next: nextIndex, unsupported: true };
                }
                return { next: nextIndex, unsupported: true };
            }
        }
        index += 1;
    }
    return { next: index, unsupported: false };
};

export const escapeHtml = (value: string): string =>
    value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
```

- [ ] **Step 3: Create `src/builder/tests/import-utils.test.ts`**

```typescript
import { expect, test } from "bun:test";
import {
    escapeHtml,
    findUnsupportedDynamicImportExpression,
    isIdentifierCharacter,
    isLocalFileImportSpecifier,
    isPackageImportSpecifier,
    isRelativeImportSpecifier,
    skipQuotedString,
    skipWhitespaceAndComments,
} from "../import-utils";

test("isRelativeImportSpecifier returns true for ./ and ../ specifiers", () => {
    expect(isRelativeImportSpecifier("./foo")).toBe(true);
    expect(isRelativeImportSpecifier("../foo")).toBe(true);
    expect(isRelativeImportSpecifier("foo")).toBe(false);
    expect(isRelativeImportSpecifier("svelte")).toBe(false);
});

test("isLocalFileImportSpecifier returns true for file: and absolute paths", () => {
    expect(isLocalFileImportSpecifier("file:///foo")).toBe(true);
    expect(isLocalFileImportSpecifier("/absolute/path")).toBe(true);
    expect(isLocalFileImportSpecifier("./foo")).toBe(false);
});

test("isPackageImportSpecifier returns true for # specifiers", () => {
    expect(isPackageImportSpecifier("#config")).toBe(true);
    expect(isPackageImportSpecifier("./foo")).toBe(false);
});

test("isIdentifierCharacter returns true for valid identifier characters", () => {
    expect(isIdentifierCharacter("a")).toBe(true);
    expect(isIdentifierCharacter("Z")).toBe(true);
    expect(isIdentifierCharacter("_")).toBe(true);
    expect(isIdentifierCharacter("$")).toBe(true);
    expect(isIdentifierCharacter("0")).toBe(true);
    expect(isIdentifierCharacter(" ")).toBe(false);
    expect(isIdentifierCharacter(undefined)).toBe(false);
});

test("skipQuotedString skips past a quoted string", () => {
    const source = "'hello world' rest";
    expect(skipQuotedString(source, 0, "'")).toBe(13);
});

test("skipQuotedString handles escaped quotes", () => {
    const source = "'hello\\'world' rest";
    expect(skipQuotedString(source, 0, "'")).toBe(16);
});

test("skipWhitespaceAndComments skips spaces", () => {
    const source = "   abc";
    expect(skipWhitespaceAndComments(source, 0)).toBe(3);
});

test("skipWhitespaceAndComments skips line comments", () => {
    const source = "// comment\nabc";
    expect(skipWhitespaceAndComments(source, 0)).toBe(11);
});

test("skipWhitespaceAndComments skips block comments", () => {
    const source = "/* comment */abc";
    expect(skipWhitespaceAndComments(source, 0)).toBe(14);
});

test("findUnsupportedDynamicImportExpression returns unsupported=false for static import()", () => {
    const source = 'import("./foo")';
    const result = findUnsupportedDynamicImportExpression(source);
    expect(result.unsupported).toBe(false);
});

test("findUnsupportedDynamicImportExpression returns unsupported=true for template literal import()", () => {
    const source = "import(`./foo`)";
    const result = findUnsupportedDynamicImportExpression(source);
    expect(result.unsupported).toBe(true);
});

test("findUnsupportedDynamicImportExpression returns unsupported=true for dynamic expression import()", () => {
    const source = "import(variable)";
    const result = findUnsupportedDynamicImportExpression(source);
    expect(result.unsupported).toBe(true);
});

test("findUnsupportedDynamicImportExpression handles template literals with nested expressions", () => {
    const source = "import(`./${lang}.js`)";
    const result = findUnsupportedDynamicImportExpression(source);
    expect(result.unsupported).toBe(true);
});

test("escapeHtml escapes HTML special characters", () => {
    expect(escapeHtml('<div class="test">Tom & Jerry\'s</div>')).toBe(
        "&lt;div class=&quot;test&quot;&gt;Tom &amp; Jerry&#39;s&lt;/div&gt;",
    );
});
```

- [ ] **Step 4: Run the new test file**

```bash
cd /home/_/._/svelte-lib && bun test src/builder/tests/import-utils.test.ts 2>&1
```
Expected: All tests pass

- [ ] **Step 5: Commit**

```bash
cd /home/_/._/svelte-lib && git add src/builder/import-utils.ts src/builder/tests/import-utils.test.ts && git commit -m "refactor(builder): extract shared import utilities to import-utils.ts"
```

---

### Task 2: Create `build-plugins.ts` with extracted plugin code

**Files:**
- Create: `src/builder/build-plugins.ts`
- Test: `src/builder/tests/build-plugins.test.ts`

**Interfaces:**
- Consumes: `resolveSvelteBrowserImportPath` from `build-validate.ts`, `stripSvelteDiagnosticsModule` from `strip-svelte-diagnostics.ts`, `compile` from `svelte/compiler`, `Result` from `build.ts`
- Produces: `createProductionEsmEnvPlugin`, `createSvelteRuntimeAliasPlugin`, `createSveltePlugin`

- [ ] **Step 1: Create `src/builder/build-plugins.ts`**

```typescript
import type { BunPlugin } from "bun";
import { compile } from "svelte/compiler";
import { resolveSvelteBrowserImportPath } from "./build-validate";
import { stripSvelteDiagnosticsModule } from "./strip-svelte-diagnostics";
import type { Result } from "./build";

const getErrorMessage = (error: unknown): string => {
    if (error instanceof Error) return error.message;
    return String(error);
};

const ok = <T>(value: T): Result<T> => ({ ok: true, value });
const fail = (error: string): Result<never> => ({ ok: false, error });

const createScopedCssClassName = (css: string, hash: (input: string) => string): string => `_${hash(css)}`;

const readRequiredText = async (path: string): Promise<Result<string>> => {
    const file = Bun.file(path);
    const exists = await file.exists();
    if (!exists) return fail(`Missing file: ${path}`);
    return file.text().then(
        (value) => ok(value),
        (error) => fail(`Failed to read ${path}: ${getErrorMessage(error)}`),
    );
};

const compileSvelteModule = async (path: string): Promise<Result<{ css: string; js: string }>> => {
    const source = await readRequiredText(path);
    if (!source.ok) return source;

    return Promise.resolve()
        .then(() =>
            compile(source.value, {
                css: "external",
                cssHash: ({ css, hash }) => createScopedCssClassName(css, hash),
                dev: false,
                filename: path,
                generate: "client",
            }),
        )
        .then(
            ({ css, js }) => ok({ css: css?.code ?? "", js: js.code }),
            (error) => fail(`Failed to compile ${path}: ${getErrorMessage(error)}`),
        );
};

export const createProductionEsmEnvPlugin = (): BunPlugin => ({
    name: "production-esm-env-plugin",
    target: "browser",
    setup: (builder) => {
        builder.onResolve({ filter: /^esm-env\/development$/ }, () => ({
            namespace: "svelte-builder-virtual",
            path: "esm-env/development",
        }));

        builder.onLoad({ filter: /^esm-env\/development$/, namespace: "svelte-builder-virtual" }, () => ({
            contents: "export default false;",
            loader: "js",
        }));

        builder.onLoad({ filter: /internal\/(?:client|shared)\/errors\.js$/ }, async ({ path }) => ({
            contents: stripSvelteDiagnosticsModule(await Bun.file(path).text(), "errors"),
            loader: "js",
        }));

        builder.onLoad({ filter: /internal\/(?:client|shared)\/warnings\.js$/ }, async ({ path }) => ({
            contents: stripSvelteDiagnosticsModule(await Bun.file(path).text(), "warnings"),
            loader: "js",
        }));
    },
});

export const createSvelteRuntimeAliasPlugin = (rootDir: string): BunPlugin => ({
    name: "svelte-runtime-alias-plugin",
    target: "browser",
    setup: (builder) => {
        builder.onResolve({ filter: /^svelte(?:\/.*)?$/ }, ({ path }) => {
            const resolvedPath = resolveSvelteBrowserImportPath(rootDir, path);
            if (resolvedPath === null) return null;
            return { path: resolvedPath };
        });
    },
});

export const createSveltePlugin = (cssByPath: Map<string, string>): BunPlugin => ({
    name: "svelte-prod-plugin",
    target: "browser",
    setup: (builder) => {
        builder.onLoad({ filter: /\.svelte$/ }, async ({ path }) => {
            const compiled = await compileSvelteModule(path);
            if (!compiled.ok) return Promise.reject(new Error(compiled.error));

            if (compiled.value.css.length > 0) {
                cssByPath.set(path, compiled.value.css);
            }

            return { contents: compiled.value.js, loader: "js" };
        });
    },
});
```

- [ ] **Step 2: Create `src/builder/tests/build-plugins.test.ts`**

```typescript
import { expect, test } from "bun:test";
import { createProductionEsmEnvPlugin, createSvelteRuntimeAliasPlugin, createSveltePlugin } from "../build-plugins";

test("createProductionEsmEnvPlugin returns a BunPlugin with correct name", () => {
    const plugin = createProductionEsmEnvPlugin();
    expect(plugin.name).toBe("production-esm-env-plugin");
    expect(plugin.target).toBe("browser");
    expect(typeof plugin.setup).toBe("function");
});

test("createSvelteRuntimeAliasPlugin returns a BunPlugin with correct name", () => {
    const plugin = createSvelteRuntimeAliasPlugin("/tmp/test-root");
    expect(plugin.name).toBe("svelte-runtime-alias-plugin");
    expect(plugin.target).toBe("browser");
    expect(typeof plugin.setup).toBe("function");
});

test("createSveltePlugin returns a BunPlugin with correct name", () => {
    const cssByPath = new Map<string, string>();
    const plugin = createSveltePlugin(cssByPath);
    expect(plugin.name).toBe("svelte-prod-plugin");
    expect(plugin.target).toBe("browser");
    expect(typeof plugin.setup).toBe("function");
});
```

- [ ] **Step 3: Run the new test file**

```bash
cd /home/_/._/svelte-lib && bun test src/builder/tests/build-plugins.test.ts 2>&1
```
Expected: All tests pass

- [ ] **Step 4: Commit**

```bash
cd /home/_/._/svelte-lib && git add src/builder/build-plugins.ts src/builder/tests/build-plugins.test.ts && git commit -m "refactor(builder): extract build plugins to build-plugins.ts"
```

---

### Task 3: Update `build-validate.ts` to import from `import-utils.ts`

**Files:**
- Modify: `src/builder/build-validate.ts`

**Interfaces:**
- Consumes: `import-utils.ts` (Task 1)

- [ ] **Step 1: Add import line after the `compile` import**

```typescript
import {
    findUnsupportedDynamicImportExpression,
    isIdentifierCharacter,
    isLocalFileImportSpecifier,
    isPackageImportSpecifier,
    isRelativeImportSpecifier,
    skipQuotedString,
    skipWhitespaceAndComments,
} from "./import-utils";
```

- [ ] **Step 2: Delete the 7 duplicated function definitions**

Delete these lines (approximately lines 27-178, but match exact text):

```
const isRelativeImportSpecifier = (specifier: string): boolean => specifier.startsWith("./") || specifier.startsWith("../");
const isLocalFileImportSpecifier = (specifier: string): boolean => specifier.startsWith("file:") || isAbsolute(specifier);
const isPackageImportSpecifier = (specifier: string): boolean => specifier.startsWith("#");
const isIdentifierCharacter = (value: string | undefined): boolean => value !== undefined && /[A-Za-z0-9_$]/.test(value);

const skipQuotedString = (source: string, start: number, quote: "'" | '"'): number => {
    let index = start + 1;

    while (index < source.length) {
        if (source[index] === "\\") {
            index += 2;
            continue;
        }

        if (source[index] === quote) {
            return index + 1;
        }

        index += 1;
    }

    return index;
};

const skipWhitespaceAndComments = (source: string, start: number): number => {
    let index = start;

    while (index < source.length) {
        if (/\s/.test(source[index] ?? "")) {
            index += 1;
            continue;
        }

        if (source[index] === "/" && source[index + 1] === "/") {
            index += 2;
            while (index < source.length && source[index] !== "\n") {
                index += 1;
            }
            continue;
        }

        if (source[index] === "/" && source[index + 1] === "*") {
            index += 2;
            while (index < source.length && !(source[index] === "*" && source[index + 1] === "/")) {
                index += 1;
            }
            index = Math.min(index + 2, source.length);
            continue;
        }

        break;
    }

    return index;
};

const findUnsupportedDynamicImportExpression = (
    source: string,
    start = 0,
    stopCharacter?: string,
): { next: number; unsupported: boolean } => {
    let index = start;

    while (index < source.length) {
        const character = source[index];
        if (stopCharacter !== undefined && character === stopCharacter) {
            return { next: index + 1, unsupported: false };
        }

        if (character === "/" && source[index + 1] === "/") {
            index = skipWhitespaceAndComments(source, index);
            continue;
        }

        if (character === "/" && source[index + 1] === "*") {
            index = skipWhitespaceAndComments(source, index);
            continue;
        }

        if (character === "'" || character === '"') {
            index = skipQuotedString(source, index, character);
            continue;
        }

        if (character === "`") {
            index += 1;
            while (index < source.length) {
                if (source[index] === "\\") {
                    index += 2;
                    continue;
                }

                if (source[index] === "`") {
                    index += 1;
                    break;
                }

                if (source[index] === "$" && source[index + 1] === "{") {
                    const nested = findUnsupportedDynamicImportExpression(source, index + 2, "}");
                    if (nested.unsupported) {
                        return nested;
                    }
                    index = nested.next;
                    continue;
                }

                index += 1;
            }
            continue;
        }

        if (
            source.startsWith("import", index) &&
            !isIdentifierCharacter(source[index - 1]) &&
            !isIdentifierCharacter(source[index + "import".length])
        ) {
            let nextIndex = skipWhitespaceAndComments(source, index + "import".length);
            if (source[nextIndex] === "(") {
                nextIndex = skipWhitespaceAndComments(source, nextIndex + 1);
                const argumentStart = source[nextIndex];

                if (argumentStart === "'" || argumentStart === '"') {
                    index = skipQuotedString(source, nextIndex, argumentStart);
                    continue;
                }

                if (argumentStart === "`") {
                    return { next: nextIndex, unsupported: true };
                }

                return { next: nextIndex, unsupported: true };
            }
        }

        index += 1;
    }

    return { next: index, unsupported: false };
};
```

- [ ] **Step 3: Run all tests**

```bash
cd /home/_/._/svelte-lib && bun test 2>&1 | tail -30
```
Expected: All tests pass

- [ ] **Step 4: Commit**

```bash
cd /home/_/._/svelte-lib && git add src/builder/build-validate.ts && git commit -m "refactor(builder): replace duplicated functions with imports from import-utils.ts"
```

---

### Task 4: Update `build.ts` — replace duplicates and plugins with imports

**Files:**
- Modify: `src/builder/build.ts`

**Interfaces:**
- Consumes: `import-utils.ts` (Task 1), `build-plugins.ts` (Task 2)

- [ ] **Step 1: Add imports at the top of build.ts**

After the import `import { createBootstrapSource, createImportPath } from "./bootstrap";` block, add:

```typescript
import {
    escapeHtml,
    findUnsupportedDynamicImportExpression,
    isIdentifierCharacter,
    isLocalFileImportSpecifier,
    isPackageImportSpecifier,
    isRelativeImportSpecifier,
    skipQuotedString,
    skipWhitespaceAndComments,
} from "./import-utils";
import {
    createProductionEsmEnvPlugin,
    createSveltePlugin,
    createSvelteRuntimeAliasPlugin,
} from "./build-plugins";
```

- [ ] **Step 2: Remove unused imports**

Remove `import { compile } from "svelte/compiler";` (the `compile` function is only used in the plugin code which is now in `build-plugins.ts`)

Remove `import { stripSvelteDiagnosticsModule } from "./strip-svelte-diagnostics";` (only used in the plugin code)

- [ ] **Step 3: Delete the 8 duplicated function definitions + 3 plugin functions**

Delete (exact text match):
1. `const isRelativeImportSpecifier = ...`
2. `const isLocalFileImportSpecifier = ...`
3. `const isPackageImportSpecifier = ...`
4. `const isIdentifierCharacter = ...`
5. `const skipQuotedString = ...`
6. `const skipWhitespaceAndComments = ...`
7. `const findUnsupportedDynamicImportExpression = ...`
8. `const escapeHtml = ...`
9. `const createProductionEsmEnvPlugin = ...`
10. `const createSvelteRuntimeAliasPlugin = ...`
11. `const createSveltePlugin = ...`

- [ ] **Step 4: Remove `import type { BuildConfig, BunPlugin } from "bun"` if `BuildConfig` is the only remaining usage**

Check if `BunPlugin` is used elsewhere in build.ts after the plugin code is removed:
```bash
cd /home/_/._/svelte-lib && grep -n 'BunPlugin' src/builder/build.ts
```
If only in the deleted plugin code, change to `import type { BuildConfig } from "bun";`

- [ ] **Step 5: Run all tests**

```bash
cd /home/_/._/svelte-lib && bun test 2>&1 | tail -30
```
Expected: All tests pass

- [ ] **Step 6: Commit**

```bash
cd /home/_/._/svelte-lib && git add src/builder/build.ts && git commit -m "refactor(builder): replace duplicates and plugins with imports"
```

---

### Task 5: Verify no remaining duplicate code

**Files:**
- Check only: no files modified

- [ ] **Step 1: Verify no duplicate function definitions remain**

```bash
cd /home/_/._/svelte-lib && grep -n 'const skipQuotedString\|const skipWhitespaceAndComments\|const findUnsupportedDynamicImportExpression\|const escapeHtml\|const isRelativeImportSpecifier\|const isLocalFileImportSpecifier\|const isPackageImportSpecifier\|const isIdentifierCharacter' src/builder/build.ts src/builder/build-validate.ts
```
Expected: No output

- [ ] **Step 2: Verify plugins only defined in build-plugins.ts**

```bash
cd /home/_/._/svelte-lib && grep -n 'createProductionEsmEnvPlugin\|createSvelteRuntimeAliasPlugin\|createSveltePlugin' src/builder/build.ts
```
Expected: No output

- [ ] **Step 3: Run full test suite**

```bash
cd /home/_/._/svelte-lib && bun test 2>&1
```
Expected: All tests pass

- [ ] **Step 4: Commit any remaining changes**

```bash
cd /home/_/._/svelte-lib && git add -A && git commit -m "refactor(builder): verify clean extraction"
```
