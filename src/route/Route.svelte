<script lang="ts">
    import {
        getCurrentSearch,
        getMatchedRouteId,
        initRouteSystem,
        registerRoute,
        subscribeRuntime,
    } from "./router.svelte.ts";
    import { decodeRouteProps } from "./query.ts";
    import {
        isPromiseLike,
        resolveLazyRouteComponent,
    } from "./route-validation.ts";
    import type {
        LazyRouteLoader,
        RouteComponent,
        RouteDecoder,
        RouteDecoderMap,
        RouteEntry,
        SyncRouteComponent,
    } from "./types.ts";

    type RouteConfig = {
        path: string;
        component: RouteComponent;
    };

    type RouteConfigInput = RouteConfig & Record<string, unknown>;

    type ValidatedRouteConfig = RouteConfig & {
        decoders: RouteDecoderMap;
    };

    let routeConfigInput = $props();

    const isDecoder = ((value) =>
        value === String ||
        value === Number ||
        value === Boolean ||
        typeof value === "function") as (
        value: unknown,
    ) => value is RouteDecoder;

    const validateRouteConfig = (): ValidatedRouteConfig => {
        const config = routeConfigInput as RouteConfigInput;

        if (typeof config.path !== "string") {
            throw new Error("Route path must be a string");
        }

        if (
            config.path !== "*" &&
            (!config.path.startsWith("/") ||
                config.path.startsWith("//") ||
                config.path.includes("?") ||
                config.path.includes("#") ||
                config.path
                    .split("/")
                    .some((segment) => segment === "." || segment === ".."))
        ) {
            throw new Error(
                'Route path must be "*" or an absolute pathname without query or hash',
            );
        }

        const decoders = {} as RouteDecoderMap;
        const isLazyComponent =
            typeof config.component === "function" && config.component.length === 0;

        if (!isLazyComponent && typeof config.component !== "function") {
            throw new Error("Invalid Route component");
        }

        for (const key in config) {
            if (key === "path" || key === "component") {
                continue;
            }

            if (!key.startsWith("$")) {
                throw new Error(`Unsupported Route config: ${key}`);
            }

            const decoder = config[key];
            if (!isDecoder(decoder)) {
                throw new Error(`Invalid Route decoder: ${key}`);
            }

            decoders[key as keyof RouteDecoderMap] = decoder;
        }

        return {
            path: config.path,
            component: config.component,
            decoders,
        };
    };

    initRouteSystem();

    const config = validateRouteConfig();
    const initialComponent = config.component;
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
    let lazyLoader = $state<LazyRouteLoader | null>(
        typeof initialComponent === "function" && initialComponent.length === 0
            ? (initialComponent as LazyRouteLoader)
            : null,
    );
    let pendingLoad = $state<Promise<{ default: SyncRouteComponent }> | null>(
        null,
    );
    let lazyFailed = $state(false);
    let loadError = $state<unknown | null>(null);
    let destroyed = false;

    $effect(() => {
        const nextConfig = validateRouteConfig();
        const nextDecoderKeys = Object.keys(nextConfig.decoders);
        const initialDecoderKeys = Object.keys(config.decoders);

        if (nextConfig.path !== config.path) {
            throw new Error("Route path cannot change after mount");
        }

        if (nextConfig.component !== initialComponent) {
            throw new Error("Route component cannot change after mount");
        }

        if (nextDecoderKeys.length !== initialDecoderKeys.length) {
            throw new Error("Route decoders cannot change after mount");
        }

        for (const key of nextDecoderKeys) {
            if (
                nextConfig.decoders[key as keyof RouteDecoderMap] !==
                config.decoders[key as keyof RouteDecoderMap]
            ) {
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

    const isCurrentRouteActive = (): boolean =>
        getMatchedRouteId() === entry.id;

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
            resolvedComponent = initialComponent as SyncRouteComponent;
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

                    if (isCurrentRouteActive()) {
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
