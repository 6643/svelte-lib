import type { ResolvedAssetsDir } from "./assets";

export const resolveDevStaticAssetRequest = (
    assetsDirs: ResolvedAssetsDir[],
    pathname: string,
): { physicalRoot: string; requestedPath: string } | null => {
    const segments = pathname.split("/").filter((segment) => segment.length > 0);
    const [dirName, ...pathSegments] = segments;
    if (!dirName || pathSegments.length === 0) {
        return null;
    }

    const matchingAssetsDir = assetsDirs.find((entry) => entry.dirName === dirName);
    if (!matchingAssetsDir) {
        return null;
    }

    return {
        physicalRoot: matchingAssetsDir.physicalPath,
        requestedPath: pathSegments.join("/"),
    };
};
