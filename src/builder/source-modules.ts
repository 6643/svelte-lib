const SUPPORTED_LOCAL_SOURCE_MODULE_EXTENSIONS = [".svelte", ".ts", ".js", ".mjs"] as const;
const isTypeScriptDeclarationFile = (path: string): boolean => path.endsWith(".d.ts");

export const formatSupportedLocalSourceModuleExtensions = (): string => SUPPORTED_LOCAL_SOURCE_MODULE_EXTENSIONS.join(", ");

const JS_EXTENSIONS = [".js", ".mjs"] as const;

export const isSupportedJavaScriptSourceModule = (path: string): boolean =>
  JS_EXTENSIONS.some((ext) => path.endsWith(ext));

export const isSupportedLocalSourceModule = (path: string): boolean =>
    !isTypeScriptDeclarationFile(path) &&
    SUPPORTED_LOCAL_SOURCE_MODULE_EXTENSIONS.some((extension) => path.endsWith(extension));

export const isSupportedSvelteSourceModule = (path: string): boolean => path.endsWith(".svelte");

export const isSupportedTypeScriptSourceModule = (path: string): boolean =>
    path.endsWith(".ts") && !isTypeScriptDeclarationFile(path);
