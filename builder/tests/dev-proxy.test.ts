import { expect, test } from "bun:test";

import { createDevProxyFetchInit, createDevProxyHeaders, shouldProxyDevRequestMethod, shouldProxyDevRequestPath } from "../dev";

test("shouldProxyDevRequestPath only matches exact /items and /cron path boundaries", () => {
    expect(shouldProxyDevRequestPath("/items")).toBe(true);
    expect(shouldProxyDevRequestPath("/items/42")).toBe(true);
    expect(shouldProxyDevRequestPath("/cron")).toBe(true);
    expect(shouldProxyDevRequestPath("/cron/run")).toBe(true);

    expect(shouldProxyDevRequestPath("/itemshelf")).toBe(false);
    expect(shouldProxyDevRequestPath("/cronology")).toBe(false);
    expect(shouldProxyDevRequestPath("/item")).toBe(false);
    expect(shouldProxyDevRequestPath("/crony")).toBe(false);
});

test("shouldProxyDevRequestMethod only allows safe proxy methods", () => {
    expect(shouldProxyDevRequestMethod("GET")).toBe(true);
    expect(shouldProxyDevRequestMethod("HEAD")).toBe(true);
    expect(shouldProxyDevRequestMethod("POST")).toBe(false);
    expect(shouldProxyDevRequestMethod("PUT")).toBe(false);
});

test("createDevProxyHeaders strips credential-bearing and nonessential headers", () => {
    const headers = new Headers({
        Accept: "application/json",
        "Accept-Language": "zh-CN",
        Authorization: "Bearer secret",
        Cookie: "sid=secret",
        "If-None-Match": "etag-1",
        "X-Forwarded-For": "127.0.0.1",
    });

    const proxyHeaders = createDevProxyHeaders(headers);

    expect(proxyHeaders.get("accept")).toBe("application/json");
    expect(proxyHeaders.get("accept-language")).toBe("zh-CN");
    expect(proxyHeaders.get("if-none-match")).toBe("etag-1");
    expect(proxyHeaders.has("authorization")).toBe(false);
    expect(proxyHeaders.has("cookie")).toBe(false);
    expect(proxyHeaders.has("x-forwarded-for")).toBe(false);
});

test("createDevProxyFetchInit preserves the request abort signal", () => {
    const controller = new AbortController();
    const request = new Request("https://app.test/items", {
        headers: { Accept: "application/json" },
        method: "GET",
        signal: controller.signal,
    });

    const init = createDevProxyFetchInit(request);

    expect(init.method).toBe("GET");
    expect(init.signal).toBe(controller.signal);
});
