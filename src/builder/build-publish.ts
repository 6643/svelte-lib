import { randomUUID } from "node:crypto";
import { lstatSync, realpathSync } from "node:fs";
import { mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import { basename, dirname, isAbsolute, join, relative } from "node:path";

type Result<T> = { ok: true; value: T } | { ok: false; error: string };

const STAGE_OUTDIR_NAME = ".bsp-stage";
const TEMP_OUTDIR_NAME = "bsp-out";
const RELEASES_DIR_NAME = ".bsp-releases";
const PUBLISH_PATH_HASH_HEX_LENGTH = 8;

const ok = <T>(value: T): Result<T> => ({ ok: true, value });
const fail = (error: string): Result<never> => ({ ok: false, error });

const getErrorMessage = (error: unknown): string => {
    if (error instanceof Error) {
        return error.message;
    }

    return String(error);
};

const getErrorCode = (error: unknown): string | undefined =>
    error instanceof Error && "code" in error && typeof error.code === "string" ? error.code : undefined;

const createPathHash = (content: string): string =>
    new Bun.CryptoHasher("sha256").update(content).digest("hex").slice(0, PUBLISH_PATH_HASH_HEX_LENGTH);

const isPathWithinRoot = (rootPath: string, candidatePath: string): boolean => {
    const relativePath = relative(rootPath, candidatePath);

    return relativePath === "" || (!relativePath.startsWith("..") && !isAbsolute(relativePath));
};

const createStageDirPrefix = (rootDir: string, outDir: string): string =>
    `${STAGE_OUTDIR_NAME}-${createPathHash(relative(rootDir, outDir).replace(/\\/g, "/"))}`;

const createPublishLockPath = (outDir: string): string => `${outDir}.lock`;

const createPendingPublishLockPath = (outDir: string, nonce: string): string =>
    join(dirname(outDir), `.${basename(outDir)}.lock-${nonce}`);

const createRollbackOutDirPrefix = (outDir: string): string => `.${basename(outDir)}.rollback-`;

const createRollbackOutDir = (outDir: string, nonce: string): string =>
    join(dirname(outDir), `${createRollbackOutDirPrefix(outDir)}${nonce}`);

const createPublishLockOwnerPath = (lockPath: string): string => join(lockPath, "owner.json");

const isPidAlive = (pid: number): boolean => {
    try {
        process.kill(pid, 0);
        return true;
    } catch (error) {
        if (error instanceof Error && "code" in error && error.code === "ESRCH") {
            return false;
        }

        return true;
    }
};

const resolveLegacyReleaseTarget = (rootDir: string, outDir: string): string | undefined => {
    const releasesDir = join(rootDir, RELEASES_DIR_NAME);

    try {
        if (!lstatSync(outDir).isSymbolicLink()) {
            return undefined;
        }

        const resolvedOutDir = realpathSync(outDir);
        if (!isPathWithinRoot(releasesDir, resolvedOutDir) || resolvedOutDir === releasesDir) {
            return undefined;
        }

        return resolvedOutDir;
    } catch {
        return undefined;
    }
};

const cleanupLegacyReleaseTarget = async (rootDir: string, releaseTarget: string | undefined): Promise<void> => {
    if (releaseTarget === undefined) {
        return;
    }

    await rm(releaseTarget, { force: true, recursive: true }).catch(() => undefined);

    const releasesDir = join(rootDir, RELEASES_DIR_NAME);
    await readdir(releasesDir)
        .then(async (entries) => {
            if (entries.length === 0) {
                await rm(releasesDir, { force: true, recursive: true }).catch(() => undefined);
            }
        })
        .catch(() => undefined);
};

const pathExists = (path: string): boolean => {
    try {
        lstatSync(path);
        return true;
    } catch {
        return false;
    }
};

const cleanupRecoveredRollbackOutDirs = async (outDir: string): Promise<void> => {
    const rollbackPrefix = createRollbackOutDirPrefix(outDir);
    const outDirParent = dirname(outDir);

    const rollbackDirs = await readdir(outDirParent)
        .then((entries) =>
            entries
                .filter((entry) => entry.startsWith(rollbackPrefix))
                .map((entry) => join(outDirParent, entry))
                .sort((left, right) => {
                    const leftMtime = (() => {
                        try {
                            return lstatSync(left).mtimeMs;
                        } catch {
                            return 0;
                        }
                    })();
                    const rightMtime = (() => {
                        try {
                            return lstatSync(right).mtimeMs;
                        } catch {
                            return 0;
                        }
                    })();

                    return rightMtime - leftMtime;
                }),
        )
        .catch(() => []);

    if (rollbackDirs.length === 0) {
        return;
    }

    if (!pathExists(outDir)) {
        const [restoreDir, ...staleDirs] = rollbackDirs;
        if (restoreDir !== undefined) {
            await rename(restoreDir, outDir).catch(() => undefined);
        }

        await Promise.all(staleDirs.map((dir) => rm(dir, { force: true, recursive: true }).catch(() => undefined)));
        return;
    }

    await Promise.all(rollbackDirs.map((dir) => rm(dir, { force: true, recursive: true }).catch(() => undefined)));
};

const cleanupRecoveredBuildState = async (rootDir: string, outDir: string): Promise<void> => {
    await cleanupLegacyReleaseTarget(rootDir, resolveLegacyReleaseTarget(rootDir, outDir));
    await cleanupRecoveredRollbackOutDirs(outDir);

    await readdir(rootDir)
        .then((entries) =>
            Promise.all(
                entries
                    .filter((entry) => entry.startsWith(`${createStageDirPrefix(rootDir, outDir)}-`))
                    .map((entry) => rm(join(rootDir, entry), { force: true, recursive: true }).catch(() => undefined)),
            ),
        )
        .catch(() => undefined);

    await readdir(dirname(outDir))
        .then((entries) =>
            Promise.all(
                entries
                    .filter((entry) => entry.startsWith(`.${basename(outDir)}.${TEMP_OUTDIR_NAME}-`))
                    .map((entry) => rm(join(dirname(outDir), entry), { force: true, recursive: true }).catch(() => undefined)),
            ),
        )
        .catch(() => undefined);

    await readdir(dirname(outDir))
        .then((entries) =>
            Promise.all(
                entries
                    .filter((entry) => entry.startsWith(`.${basename(outDir)}.lock-`))
                    .map((entry) => rm(join(dirname(outDir), entry), { force: true, recursive: true }).catch(() => undefined)),
            ),
        )
        .catch(() => undefined);
};

export const createBuildNonce = (): string => randomUUID().replace(/-/g, "");

export const createStageDir = (rootDir: string, outDir: string, nonce: string): string =>
    join(rootDir, `${createStageDirPrefix(rootDir, outDir)}-${nonce}`);

export const createTempOutDir = (outDir: string, nonce: string): string =>
    join(dirname(outDir), `.${basename(outDir)}.${TEMP_OUTDIR_NAME}-${nonce}`);

export const acquirePublishLock = async (rootDir: string, outDir: string, allowRetry = true): Promise<Result<string>> => {
    const lockPath = createPublishLockPath(outDir);
    const pendingLockPath = createPendingPublishLockPath(outDir, createBuildNonce());
    const ownerPath = createPublishLockOwnerPath(lockPath);
    const pendingOwnerPath = createPublishLockOwnerPath(pendingLockPath);

    const pendingLockReady = await mkdir(pendingLockPath).then(
        () => ok(pendingLockPath),
        (error) => fail(`Failed to create pending build lock ${pendingLockPath}: ${getErrorMessage(error)}`),
    );
    if (!pendingLockReady.ok) {
        return pendingLockReady;
    }

    const pendingOwnerWritten = await writeFile(pendingOwnerPath, JSON.stringify({ pid: process.pid }), "utf8").then(
        () => ok(pendingOwnerPath),
        (error) => fail(`Failed to write build lock owner ${pendingOwnerPath}: ${getErrorMessage(error)}`),
    );
    if (!pendingOwnerWritten.ok) {
        await rm(pendingLockPath, { force: true, recursive: true }).catch(() => undefined);
        return pendingOwnerWritten;
    }

    return rename(pendingLockPath, lockPath).then(
        () => ok(lockPath),
        async (error: unknown) => {
            await rm(pendingLockPath, { force: true, recursive: true }).catch(() => undefined);

            if (!(error instanceof Error) || !("code" in error) || (error.code !== "EEXIST" && error.code !== "ENOTEMPTY")) {
                return fail(`Failed to acquire build lock ${lockPath}: ${getErrorMessage(error)}`);
            }

            const owner = await readFile(ownerPath, "utf8").then(
                (value) =>
                    Promise.resolve(value)
                        .then((text) => JSON.parse(text) as { pid?: unknown })
                        .then(
                            (parsed) =>
                                typeof parsed.pid === "number" ? ok<number | null>(parsed.pid) : ok<number | null>(null),
                            () => ok<number | null>(null),
                        ),
                () => ok<number | null>(null),
            );
            if (!owner.ok) {
                return owner;
            }

            if (owner.value !== null && isPidAlive(owner.value)) {
                return fail(`Another build is already running for ${outDir} (pid ${owner.value}).`);
            }

            if (!allowRetry) {
                return fail(`Failed to recover stale build lock ${lockPath}.`);
            }

            await rm(lockPath, { force: true, recursive: true }).catch(() => undefined);
            await cleanupRecoveredBuildState(rootDir, outDir);
            return acquirePublishLock(rootDir, outDir, false);
        },
    );
};

export const publishBuildOutput = async (rootDir: string, tempOutDir: string, outDir: string): Promise<Result<string>> => {
    const legacyReleaseTarget = resolveLegacyReleaseTarget(rootDir, outDir);
    const rollbackOutDir = createRollbackOutDir(outDir, createBuildNonce());
    let movedExistingOutDir = false;

    const movedExisting = await rename(outDir, rollbackOutDir).then(
        () => {
            movedExistingOutDir = true;
            return ok<void>(undefined);
        },
        (error: unknown) => {
            if (getErrorCode(error) === "ENOENT") {
                return ok<void>(undefined);
            }

            return fail(`Failed to prepare ${outDir} for publish: ${getErrorMessage(error)}`);
        },
    );
    if (!movedExisting.ok) {
        return movedExisting;
    }

    const published = await rename(tempOutDir, outDir).then(
        () => ok(outDir),
        (error) => fail(`Failed to publish ${outDir}: ${getErrorMessage(error)}`),
    );
    if (!published.ok) {
        if (movedExistingOutDir) {
            const restored = await rename(rollbackOutDir, outDir).then(
                () => ok(outDir),
                (error) => fail(`Failed to restore previous output for ${outDir}: ${getErrorMessage(error)}`),
            );
            if (!restored.ok) {
                return fail(`${published.error} ${restored.error}`);
            }
        }

        return published;
    }

    if (movedExistingOutDir) {
        await rm(rollbackOutDir, { force: true, recursive: true }).catch(() => undefined);
    }
    await cleanupLegacyReleaseTarget(rootDir, legacyReleaseTarget);
    return published;
};
