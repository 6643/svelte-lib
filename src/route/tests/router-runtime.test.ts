import { expect, test } from "bun:test";
import { JSDOM } from "jsdom";

import {
    __resetRuntimeForTest,
    getMatchedRouteId,
    initRuntime,
    registerRoute,
    routeBackPath,
    routeCurrentPath,
    routePush,
    subscribeRuntime,
} from "../runtime.ts";

const installDom = (path = "/a"): (() => void) => {
    const dom = new JSDOM("<!doctype html><html><body></body></html>", {
        url: `https://app.test${path}`,
    });

    const globals = globalThis as any;

    globals.window = dom.window;
    globals.document = dom.window.document;
    globals.history = dom.window.history;
    globals.location = dom.window.location;

    return () => {
        dom.window.close();
        delete globals.window;
        delete globals.document;
        delete globals.history;
        delete globals.location;
    };
};

test("runtime tracks route registration and push navigation", () => {
    const cleanup = installDom("/a");
    __resetRuntimeForTest();
    initRuntime();

    const exact = Symbol("/a");
    const fallback = Symbol("*");
    const unregisterFallback = registerRoute({ id: fallback, path: "*", component: (() => null) as never, decoders: {} });
    const unregisterExact = registerRoute({ id: exact, path: "/a", component: (() => null) as never, decoders: {} });

    expect(getMatchedRouteId()).toBe(exact);
    expect(routeCurrentPath()).toBe("/a");
    expect(routeBackPath()).toBeNull();

    routePush("/b");
    expect(routeCurrentPath()).toBe("/b");
    expect(routeBackPath()).toBe("/a");

    unregisterExact();
    unregisterFallback();
    cleanup();
});

test("runtime notifies subscribers when the active route changes", () => {
    const cleanup = installDom("/a");
    __resetRuntimeForTest();
    initRuntime();

    let notifications = 0;
    const unsubscribe = subscribeRuntime(() => {
        notifications += 1;
    });

    const unregisterFallback = registerRoute({ id: Symbol("*"), path: "*", component: (() => null) as never, decoders: {} });
    const unregisterExact = registerRoute({ id: Symbol("/a"), path: "/a", component: (() => null) as never, decoders: {} });

    expect(notifications > 0).toBe(true);

    unregisterExact();
    unregisterFallback();
    unsubscribe();
    cleanup();
});
