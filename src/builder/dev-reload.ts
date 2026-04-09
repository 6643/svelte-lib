import { lstatSync, readdirSync, realpathSync, watch } from "node:fs";
import { isAbsolute, join, relative } from "node:path";
import { isSupportedLocalSourceModule } from "./source-modules";

export type DevWatchRoot = {
    path: string;
    recursive: boolean;
};

export type DevWatchTarget =
    | { kind: "config" }
    | { kind: "directory"; path: string }
    | { kind: "ignore" }
    | { kind: "module"; modulePath: string };

export type DevReloadHub<TCache> = {
    cache: TCache;
    emit: (data: string) => void;
    reconfigure: (watchRoots: DevWatchRoot[]) => void;
    stop: () => void;
    subscribe: (listener: (data: string) => void) => () => void;
};

const DEV_CONFIG_FILE_NAME = "builder.ts";
const DEV_WATCH_DEBOUNCE_MS = 100;
const EXCLUDED_DIRS = ["node_modules", ".git", "dist"];

const getErrorMessage = (error: unknown): string => {
    if (error instanceof Error) {
        return error.message;
    }

    return String(error);
};

const isCompilableDevModule = (filePath: string): boolean => isSupportedLocalSourceModule(filePath);

const isExcludedWatchDirectory = (dirName: string): boolean => EXCLUDED_DIRS.includes(dirName);

const getWatcherErrorCode = (error: unknown): string | undefined =>
    typeof error === "object" && error !== null && "code" in error && typeof error.code === "string" ? error.code : undefined;

const isIgnorableDevWatcherError = (error: unknown): boolean => {
    const errorCode = getWatcherErrorCode(error);
    return errorCode === "ENOENT" || errorCode === "ENOTDIR";
};

export const classifyDevWatchTarget = ({
    eventPath,
    fileStatus,
    filename,
    watchDir,
}: {
    eventPath: string;
    fileStatus: "directory" | "file" | "missing" | "other";
    filename: string;
    watchDir: string;
}): DevWatchTarget => {
    const relativePath = relative(watchDir, eventPath);
    if (relativePath.startsWith("..") || relativePath.length === 0) {
        return { kind: "ignore" };
    }

    if (relativePath === DEV_CONFIG_FILE_NAME) {
        return { kind: "config" };
    }

    if (fileStatus === "directory") {
        if (!isExcludedWatchDirectory(filename) && !filename.startsWith(".")) {
            return { kind: "directory", path: eventPath };
        }

        return { kind: "ignore" };
    }

    if (fileStatus === "file" || fileStatus === "missing") {
        return isCompilableDevModule(relativePath) ? { kind: "module", modulePath: relativePath } : { kind: "ignore" };
    }

    return { kind: "ignore" };
};

export const formatDevWatcherIssue = (context: string, error: unknown): string | undefined => {
    if (isIgnorableDevWatcherError(error)) {
        return undefined;
    }

    return `[svelte-dev] ${context}: ${getErrorMessage(error)}`;
};

const reportDevWatcherIssue = (context: string, error: unknown): void => {
    const issue = formatDevWatcherIssue(context, error);
    if (issue !== undefined) {
        console.warn(issue);
    }
};

export const attachDevWatcherErrorHandler = (
    watcher: { on: (event: string, handler: (error: unknown) => void) => unknown },
    context: string,
): void => {
    watcher.on("error", (error) => {
        reportDevWatcherIssue(context, error);
    });
};

export const shouldProcessDevWatchEvent = (
    recentEvents: Map<string, number>,
    modulePath: string,
    now = Date.now(),
): boolean => {
    const previous = recentEvents.get(modulePath);
    recentEvents.set(modulePath, now);

    if (previous !== undefined && now - previous < DEV_WATCH_DEBOUNCE_MS) {
        return false;
    }

    for (const [path, timestamp] of recentEvents) {
        if (now - timestamp >= DEV_WATCH_DEBOUNCE_MS) {
            recentEvents.delete(path);
        }
    }

    return true;
};

export const createDevReloadHub = <TCache>(
    watchDir: string,
    watchRoots: DevWatchRoot[],
    cache: TCache,
    compileChangedModule: (modulePath: string, allowedRoots: string[]) => Promise<void>,
    onConfigFileChange?: () => void | Promise<void>,
): DevReloadHub<TCache> => {
    const watchers: { close: () => void }[] = [];
    const listeners = new Set<(data: string) => void>();
    const recentEvents = new Map<string, number>();
    const watchedDirs = new Set<string>();
    let recursiveWatchRoots = new Set(watchRoots.filter((root) => root.recursive).map((root) => root.path));
    let allowedRoots = Array.from(
        new Set(
            watchRoots
                .filter((root) => root.recursive)
                .map((root) => {
                    try {
                        return realpathSync(root.path);
                    } catch {
                        return root.path;
                    }
                }),
        ),
    );

    const stopWatchers = (): void => {
        watchers.forEach((watcher) => watcher.close());
        watchers.length = 0;
        watchedDirs.clear();
    };

    const stop = (): void => {
        stopWatchers();
        listeners.clear();
    };

    const notify = (data: string): void => {
        for (const listener of listeners) {
            listener(data);
        }
    };

    const isWatchableDirectory = (path: string): boolean => {
        const entry = lstatSync(path);
        return entry.isDirectory() && !entry.isSymbolicLink();
    };

    const watchDirectory = (dir: string, recursive: boolean) => {
        if (watchedDirs.has(dir)) {
            return;
        }

        try {
            watchedDirs.add(dir);
            const watcher = watch(dir, (_eventType, filename) => {
                if (typeof filename !== "string" || filename.length === 0) {
                    notify("reload");
                    return;
                }

                try {
                    const modulePath = join(dir, filename);
                    const fileStatus = (() => {
                        try {
                            const entry = lstatSync(modulePath);
                            if (entry.isDirectory()) return "directory" as const;
                            if (entry.isFile()) return "file" as const;
                            return "other" as const;
                        } catch (error) {
                            return isIgnorableDevWatcherError(error)
                                ? ("missing" as const)
                                : (() => {
                                      throw error;
                                  })();
                        }
                    })();

                    const target = classifyDevWatchTarget({
                        eventPath: modulePath,
                        fileStatus,
                        filename,
                        watchDir,
                    });

                    if (target.kind === "config") {
                        void Promise.resolve(onConfigFileChange?.()).catch((error) => {
                            console.error(getErrorMessage(error));
                        });
                        return;
                    }

                    if (target.kind === "directory") {
                        if (recursive || recursiveWatchRoots.has(target.path)) {
                            watchDirectory(target.path, true);
                        }
                        return;
                    }

                    if (target.kind !== "module") {
                        return;
                    }

                    if (!shouldProcessDevWatchEvent(recentEvents, target.modulePath)) {
                        return;
                    }

                    notify("reload");
                    void compileChangedModule(target.modulePath, allowedRoots);
                } catch (error) {
                    reportDevWatcherIssue(`watch event for ${join(dir, filename)}`, error);
                }
            });
            attachDevWatcherErrorHandler(watcher, `watch runtime for ${dir}`);
            watchers.push(watcher);
            if (recursive) {
                readdirSync(dir).forEach((file) => {
                    const fullPath = join(dir, file);
                    if (isWatchableDirectory(fullPath) && !isExcludedWatchDirectory(file) && !file.startsWith(".")) {
                        watchDirectory(fullPath, true);
                    }
                });
            }
        } catch (error) {
            watchedDirs.delete(dir);
            reportDevWatcherIssue(`watch setup for ${dir}`, error);
        }
    };

    const reconfigure = (nextWatchRoots: DevWatchRoot[]): void => {
        stopWatchers();
        recentEvents.clear();

        recursiveWatchRoots = new Set(nextWatchRoots.filter((root) => root.recursive).map((root) => root.path));
        allowedRoots = Array.from(
            new Set(
                nextWatchRoots
                    .filter((root) => root.recursive)
                    .map((root) => {
                        try {
                            return realpathSync(root.path);
                        } catch {
                            return root.path;
                        }
                    }),
            ),
        );

        nextWatchRoots.forEach((root) => watchDirectory(root.path, root.recursive));
    };

    reconfigure(watchRoots);

    return {
        cache,
        emit: notify,
        reconfigure,
        stop,
        subscribe: (listener) => {
            listeners.add(listener);
            return () => {
                listeners.delete(listener);
            };
        },
    };
};

export const createSSEResponse = <TCache>(hub: DevReloadHub<TCache>, signal: AbortSignal): Response => {
    const listeners: Array<() => void> = [];

    const stream = new ReadableStream({
        start: (controller) => {
            const send = (data: string) => controller.enqueue(`data: ${data}\n\n`);
            const timer = setInterval(() => controller.enqueue(":heartbeat\n\n"), 15000);

            const cleanup = () => {
                clearInterval(timer);
                listeners.forEach((unsubscribe) => unsubscribe());
                try {
                    if (controller.desiredSize !== null) {
                        controller.close();
                    }
                } catch {}
            };

            signal.addEventListener("abort", cleanup);
            listeners.push(hub.subscribe((data) => send(data)));
        },
    });

    return new Response(stream, {
        headers: {
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
            "Content-Type": "text/event-stream",
        },
    });
};
