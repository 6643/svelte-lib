<script lang="ts">
    import { setContext } from "svelte";

    type Props = {
        api: (page: number, args?: any) => Promise<boolean>;
        args?: any;
        threshold?: number;
    };

    let { api, args, threshold = 320 }: Props = $props();

    let el: HTMLDivElement | undefined;
    let hasMore = $state(true);
    let page = $state(0);
    let loading = $state(false);

    const getDistanceToBottom = (): number => {
        if (!el) return Infinity;
        const rect = el.getBoundingClientRect();
        return rect.top - globalThis.innerHeight;
    };

    const load = async () => {
        if (!hasMore || loading || !el) return;
        if (getDistanceToBottom() > threshold) return;
        loading = true;
        try {
            const hasMoreResult = await api(page, args);
            hasMore = hasMoreResult;
            if (hasMoreResult) page++;
        } catch (e) {
            console.error("LoadMore error:", e);
        } finally {
            loading = false;
        }
    };

    let scrollTimer: ReturnType<typeof setTimeout> | undefined;

    $effect(() => {
        if (!el) return;
        const onScroll = () => {
            if (scrollTimer) clearTimeout(scrollTimer);
            scrollTimer = setTimeout(load, 100);
        };
        window.addEventListener("scroll", onScroll, { passive: true });
        queueMicrotask(load);
        return () => {
            window.removeEventListener("scroll", onScroll);
            if (scrollTimer) clearTimeout(scrollTimer);
        };
    });

    const reset = () => { page = 0; hasMore = true; loading = false; queueMicrotask(load); };

    setContext("loadMore", { reset });
</script>

<div bind:this={el}></div>
{#if loading}<div class="loading">加载中...</div>{/if}

<style>
    .loading { display: block; text-align: center; color: var(--sunken-fg); padding: 8px; font-size: 13px; }
</style>
