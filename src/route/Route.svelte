<script lang="ts">
    import { getCurrentSearch, getMatchedRouteId, initRuntime, registerRoute, subscribeRuntime } from "./runtime.ts";
    import { decodeRouteProps } from "./query.ts";
    import { isPromiseLike, resolveLazyRouteComponent } from "./lazy.ts";
    import { validateRouteConfig } from "./validation.ts";
    import type { RouteEntry, SyncRouteComponent } from "./types.ts";

    const routeConfigInput = $props();

    initRuntime();

    const readRouteConfig = () => validateRouteConfig(routeConfigInput as Record<string, unknown>);
    const config = readRouteConfig();
    const entry = {
        id: Symbol(config.path),
        path: config.path,
        component: config.component,
        decoders: config.decoders,
    } satisfies RouteEntry;
    let runtimeVersion = $state(0);
    const unsubscribe = subscribeRuntime(() => {
        runtimeVersion += 1;
    });
    const unregister = registerRoute(entry);
    let resolvedComponent = $state<SyncRouteComponent | null>(null);
    let lazyLoader = $state(config.lazyLoader);
    let pendingLoad = $state<Promise<{ default: SyncRouteComponent }> | null>(
        null,
    );
    let lazyFailed = $state(false);
    let loadError = $state<unknown | null>(null);
    let destroyed = false;

    $effect(() => {
        runtimeVersion;
        const nextConfig = readRouteConfig();

        if (nextConfig.path !== config.path) {
            throw new Error("Route path cannot change after mount");
        }

        if (nextConfig.component !== config.component) {
            throw new Error("Route component cannot change after mount");
        }

        if (Object.keys(nextConfig.decoders).length !== Object.keys(config.decoders).length) {
            throw new Error("Route decoders cannot change after mount");
        }

        for (const key in nextConfig.decoders) {
            if (nextConfig.decoders[key as keyof typeof nextConfig.decoders] !== config.decoders[key as keyof typeof config.decoders]) {
                throw new Error("Route decoders cannot change after mount");
            }
        }
    });

    $effect(() => {
        return () => {
            unsubscribe();
        };
    });

    $effect(() => {
        return unregister;
    });

    $effect(() => {
        return () => {
            destroyed = true;
        };
    });

    const active = $derived.by(() => {
        runtimeVersion;
        return getMatchedRouteId() === entry.id;
    });

    const decodedProps = $derived.by(() => {
        runtimeVersion;
        return active
            ? decodeRouteProps(getCurrentSearch(), entry.decoders)
            : {};
    });

    $effect(() => {
        loadError = null;

        if (!active) {
            lazyFailed = false;

            if (!lazyLoader) {
                resolvedComponent = null;
            }

            return;
        }

        if (!lazyLoader) {
            resolvedComponent = config.component as SyncRouteComponent;
            return;
        }

        if (resolvedComponent) {
            return;
        }

        if (pendingLoad || lazyFailed) {
            return;
        }
    });

    $effect(() => {
        if (
            !active ||
            resolvedComponent ||
            !lazyLoader ||
            pendingLoad ||
            lazyFailed
        ) {
            return;
        }

        const nextLoad = lazyLoader();

        if (!isPromiseLike(nextLoad)) {
            lazyFailed = true;
            loadError = new Error("Lazy route loader must return a promise");
            return;
        }

        pendingLoad = nextLoad as Promise<{ default: SyncRouteComponent }>;

        pendingLoad
            .then((module) => {
                if (!destroyed) {
                    resolvedComponent = resolveLazyRouteComponent(module);
                    pendingLoad = null;
                }
            })
            .catch((error) => {
                if (!destroyed) {
                    pendingLoad = null;

                    if (getMatchedRouteId() === entry.id) {
                        lazyFailed = true;
                        loadError = error;
                    }
                }
            });
    });

    $effect(() => {
        if (loadError) {
            throw loadError;
        }
    });
</script>

{#if active && resolvedComponent}
    {@const ActiveComponent = resolvedComponent}
    <ActiveComponent {...decodedProps} />
{/if}
