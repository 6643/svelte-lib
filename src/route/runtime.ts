import {
    buildPushState,
    buildReplaceState,
    createManagedHistoryOwner,
    createManagedRouteState,
    normalizeHistoryState,
} from "./history.ts";
import { normalizeNavigationTarget } from "./navigation.ts";
import type { RouteEntry, RouteHistoryState } from "./types.ts";

type RouteRuntime = {
    initialized: boolean;
    currentPath: string;
    historyOwner: string;
    historyState: RouteHistoryState;
    entries: RouteEntry[];
    listeners: Set<() => void>;
    matchedRouteId: symbol | null;
    matchDirty: boolean;
    runtimeWindow: Window | null;
};

const createInitialHistoryState = (owner: string): RouteHistoryState => ({
    __route: createManagedRouteState(
        {
            index: 0,
            stack: ["/"],
        },
        owner,
    ),
});

const createRouteRuntime = (): RouteRuntime => {
    const historyOwner = createManagedHistoryOwner();

    return {
        initialized: false,
        currentPath: "/",
        historyOwner,
        historyState: createInitialHistoryState(historyOwner),
        entries: [],
        listeners: new Set<() => void>(),
        matchedRouteId: null,
        matchDirty: true,
        runtimeWindow: null,
    };
};

let runtime = createRouteRuntime();

const invalidateRouteMatch = (): void => {
    runtime.matchDirty = true;
};

const notify = (): void => {
    for (const listener of runtime.listeners) {
        listener();
    }
};

const ensureBrowser = (): void => {
    if (
        typeof window === "undefined" ||
        typeof document === "undefined" ||
        typeof history === "undefined" ||
        typeof location === "undefined"
    ) {
        throw new Error("svelte-route requires a browser environment");
    }
};

const readCurrentPath = (): string => `${window.location.pathname}${window.location.search}` || "/";
const getCurrentPathname = (): string => runtime.currentPath.split("?")[0] || "/";

const findMatchedRouteId = (routeEntries: RouteEntry[]): symbol | null => {
    const pathname = getCurrentPathname();
    let fallbackId: symbol | null = null;

    for (let index = routeEntries.length - 1; index >= 0; index -= 1) {
        const entry = routeEntries[index];

        if (entry.path === pathname) {
            return entry.id;
        }

        if (fallbackId == null && entry.path === "*") {
            fallbackId = entry.id;
        }
    }

    return fallbackId;
};

const syncRuntimeFromBrowser = (nextHistoryState: unknown): void => {
    const nextPath = readCurrentPath();
    const pathChanged = nextPath !== runtime.currentPath;

    runtime.currentPath = nextPath;
    runtime.historyState = normalizeHistoryState(nextHistoryState, nextPath, runtime.historyOwner);

    if (pathChanged) {
        invalidateRouteMatch();
    }
};

const handlePopState = (event: PopStateEvent): void => {
    ensureBrowser();
    syncRuntimeFromBrowser(event.state);
    notify();
};

const bindRuntimeWindow = (): void => {
    if (runtime.runtimeWindow === window) {
        return;
    }

    runtime.runtimeWindow?.removeEventListener("popstate", handlePopState);
    window.addEventListener("popstate", handlePopState);
    runtime.runtimeWindow = window;
};

const ensureRuntime = (): void => {
    ensureBrowser();

    if (!runtime.initialized) {
        syncRuntimeFromBrowser(history.state);
        bindRuntimeWindow();
        runtime.initialized = true;
        return;
    }

    if (runtime.runtimeWindow !== window) {
        bindRuntimeWindow();
    }
};

export const initRuntime = (): void => {
    ensureRuntime();
};

const navigate = (kind: "push" | "replace", target: string): void => {
    ensureRuntime();

    const nextPath = normalizeNavigationTarget(target, runtime.currentPath, window.location.origin);
    const nextUrl = target === "?" || target.startsWith("?") ? `${nextPath}${window.location.hash}` : nextPath;

    if (nextPath === runtime.currentPath) {
        return;
    }

    const nextState =
        kind === "push"
            ? buildPushState(runtime.historyState, nextPath, runtime.historyOwner)
            : buildReplaceState(runtime.historyState, nextPath, runtime.historyOwner);

    if (kind === "push") {
        history.pushState(nextState, "", nextUrl);
    } else {
        history.replaceState(nextState, "", nextUrl);
    }

    runtime.currentPath = nextPath;
    runtime.historyState = nextState;
    invalidateRouteMatch();
    notify();
};

export const subscribeRuntime = (update: () => void): (() => void) => {
    runtime.listeners.add(update);

    return () => {
        runtime.listeners.delete(update);
    };
};

export const registerRoute = (entry: RouteEntry): (() => void) => {
    ensureRuntime();

    const previousMatch = getMatchedRouteId();
    runtime.entries = [...runtime.entries, entry];
    invalidateRouteMatch();
    const nextMatch = getMatchedRouteId();

    if (nextMatch !== previousMatch) {
        notify();
    }

    return () => {
        const beforeRemovalMatch = getMatchedRouteId();
        runtime.entries = runtime.entries.filter((candidate) => candidate.id !== entry.id);
        invalidateRouteMatch();
        const afterRemovalMatch = getMatchedRouteId();

        if (afterRemovalMatch !== beforeRemovalMatch) {
            notify();
        }
    };
};

export const getMatchedRouteId = (): symbol | null => {
    if (!runtime.matchDirty) {
        return runtime.matchedRouteId;
    }

    runtime.matchedRouteId = findMatchedRouteId(runtime.entries);
    runtime.matchDirty = false;
    return runtime.matchedRouteId;
};

export const getCurrentSearch = (): string =>
    runtime.currentPath.includes("?") ? `?${runtime.currentPath.split("?").slice(1).join("?")}` : "";

export const routePush = (path: string): void => {
    navigate("push", path);
};

export const routeReplace = (path: string): void => {
    navigate("replace", path);
};

export const routeCurrentPath = (): string => {
    ensureRuntime();
    return runtime.currentPath;
};

export const routeBackPath = (): string | null => {
    ensureRuntime();
    return runtime.historyState.__route.stack[runtime.historyState.__route.index - 1] ?? null;
};

export const __createRouteHistoryStateForTest = (route: { index: number; stack: string[] }): RouteHistoryState["__route"] =>
    createManagedRouteState(route, runtime.historyOwner);

export const __resetRuntimeForTest = (): void => {
    runtime.runtimeWindow?.removeEventListener("popstate", handlePopState);
    runtime = createRouteRuntime();
};
