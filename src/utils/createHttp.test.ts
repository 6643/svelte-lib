import { afterEach, describe, expect, it, vi } from "vite-plus/test";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
import { createHttp } from "./createHttp.ts";

describe("createHttp", () => {
  it("GET 拼 baseUrl 并解析 JSON", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response('{"ok":true}', {
          headers: { "content-type": "application/json" },
        }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const client = createHttp({ baseUrl: "https://api.test" });

    await expect(client.get("/x")).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.test/x",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("对象 body 自动 JSON 序列化并带 content-type", async () => {
    const fetchMock = vi.fn(async () => new Response("ok"));
    vi.stubGlobal("fetch", fetchMock);

    await createHttp().post("/x", { a: 1 });
    const init = (fetchMock.mock.calls[0] as unknown[])[1] as RequestInit;
    const headers = init.headers as Headers;

    expect(init.body).toBe('{"a":1}');
    expect(headers.get("content-type")).toBe("application/json");
  });

  it("非 2xx 抛错并带 status", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("boom", { status: 500 })),
    );

    await expect(createHttp().get("/x")).rejects.toMatchObject({ status: 500, message: "boom" });
  });
});
