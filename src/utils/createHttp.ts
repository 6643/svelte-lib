export type HttpOptions = RequestInit & {
  baseUrl?: string;
};

// 非 2xx 抛错 (保留 status); JSON 响应解析成对象, 其它按文本返回.
const processResponse = async (response: Response): Promise<unknown> => {
  if (!response.ok) {
    const errorText = await response.text();
    const error = new Error(errorText || `HTTP error! status: ${response.status}`);
    (error as Error & { status: number }).status = response.status;
    throw error;
  }

  const contentType = response.headers.get("content-type");
  if (contentType && contentType.includes("application/json")) return response.json();

  return response.text();
};

export const createHttp = (defaultOptions: HttpOptions = {}) => {
  const request = async (
    method: string,
    url: string,
    options: HttpOptions = {},
  ): Promise<unknown> => {
    const merged: HttpOptions = { ...defaultOptions, ...options };
    const { baseUrl, ...fetchOptions } = merged;
    const fullUrl = baseUrl ? `${baseUrl}${url}` : url;
    // HeadersInit 可能是数组或元组列表, 不能直接展开, 统一用 Headers 合并
    const headers = new Headers(defaultOptions.headers);
    new Headers(options.headers).forEach((headerValue, headerName) => {
      headers.set(headerName, headerValue);
    });

    // 非字符串/FormData 的 body 按 JSON 发送
    if (options.body && typeof options.body !== "string" && !(options.body instanceof FormData)) {
      headers.set("Content-Type", "application/json");
      fetchOptions.body = JSON.stringify(options.body);
    }

    const response = await fetch(fullUrl, { ...fetchOptions, method, headers });
    return processResponse(response);
  };

  return {
    get: <T = unknown>(url: string, options?: HttpOptions): Promise<T> =>
      request("GET", url, options) as Promise<T>,
    post: <T = unknown>(url: string, body?: unknown, options?: HttpOptions): Promise<T> =>
      request("POST", url, { ...options, body: body as BodyInit }) as Promise<T>,
    put: <T = unknown>(url: string, body?: unknown, options?: HttpOptions): Promise<T> =>
      request("PUT", url, { ...options, body: body as BodyInit }) as Promise<T>,
    del: <T = unknown>(url: string, options?: HttpOptions): Promise<T> =>
      request("DELETE", url, options) as Promise<T>,
  };
};

export const http = createHttp();
