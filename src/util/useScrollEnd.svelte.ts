import { useDebounce } from "./useDebounce.ts";

/**
 * Svelte action: 监听滚动结束，通知最新的 scrollTop。
 */
export const scrollEnd = (
    node: HTMLElement,
    params: { hook: (top: number) => void; debounceMs?: number },
) => {
    let timer: ReturnType<typeof setTimeout> | undefined;

    const handler = (event: Event) => {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => {
            params.hook((event.target as HTMLElement).scrollTop);
        }, params.debounceMs ?? 32);
    };

    node.addEventListener("scroll", handler);
    return {
        destroy() {
            if (timer) clearTimeout(timer);
            node.removeEventListener("scroll", handler);
        },
        update(newParams: { hook: (top: number) => void; debounceMs?: number }) {
            params = newParams;
        },
    };
};
