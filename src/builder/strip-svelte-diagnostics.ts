export type SvelteDiagnosticsKind = "errors" | "warnings";

export const stripSvelteDiagnosticsModule = (source: string, kind: SvelteDiagnosticsKind): string => {
    const exportStarStatements = Array.from(source.matchAll(/^\s*export\s+\*\s+from\s+['"][^'"]+['"];\s*$/gm));
    const exportedFunctions = Array.from(source.matchAll(/export function\s+(\w+)\s*\(([^)]*)\)\s*\{/g));
    const exportStatements = Array.from(source.matchAll(/^\s*export\s+/gm)).length;
    const supportedExportStatements = exportStarStatements.length + exportedFunctions.length;

    if (exportedFunctions.length === 0 || supportedExportStatements !== exportStatements) {
        throw new Error(`Unsupported Svelte ${kind} module shape for diagnostics stripping`);
    }

    return [
        ...exportStarStatements.map(([statement]) => statement.trim()),
        ...exportedFunctions.map(([, name, args]) => {
            const statement =
                kind === "errors" ? `throw Error(${JSON.stringify(name)});` : `console.warn(${JSON.stringify(name)});`;
            return `export function ${name}(${args}) { ${statement} }`;
        }),
    ].join("\n");
};
