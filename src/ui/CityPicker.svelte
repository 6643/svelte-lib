<script lang="ts">
    import type { Snippet } from "svelte";
    import SvgIcon from "./SvgIcon.svelte";
    import { icon_chevron_right } from "./svgicons";
    import { getCities, getCityPath, initCities } from "../util/cities.ts";

    type Props = {
        open: boolean;
        onClose?: VoidFunction;
        cityCode?: number;
        banCodes?: number[];
        change?: (city?: { code: number; names: string[] }) => void;
        children?: Snippet;
        url: string;
    };

    let { open, onClose, cityCode: externalCode, banCodes, change, children, url }: Props = $props();

    let pickCode = $state(externalCode ?? 0);
    let banned = $derived(new Set(banCodes ?? []));
    let breadcrumb = $derived(getCityPath(pickCode).reverse());
    let options = $derived(getCities().filter(c => c.parent === pickCode && !banned.has(c.code)));

    $effect(() => { if (externalCode != null) pickCode = externalCode; });
    $effect(() => { if (open && url && getCities().length === 0) initCities(url); });

    const pick = (city: { parent: number; code: number; name: string }) => {
        pickCode = city.code;
        if (city.code < 100000) return;
        onClose?.();
        change?.({ code: city.code, names: getCityPath(city.code).reverse().map(c => c.name) });
    };

    const toBreadcrumb = (code: number) => { pickCode = code; };
</script>

{#if children}{@render children()}{/if}
{#if open}
    <div class="cityPicker">
        <nav>
            <div role="button" tabindex="0" onclick={() => toBreadcrumb(0)}
                onkeydown={(e) => e.key === "Enter" && toBreadcrumb(0)}>全部</div>
            {#each breadcrumb as city}
                <span><SvgIcon svgPaths={icon_chevron_right} size={20} /></span>
                <div role="button" tabindex="0" onclick={() => toBreadcrumb(city.code)}
                    onkeydown={(e) => e.key === "Enter" && toBreadcrumb(city.code)}>{city.name}</div>
            {/each}
        </nav>
        <div role="region">
            {#each options as city}
                <div role="button" tabindex="0" onclick={() => pick(city)}
                    onkeydown={(e) => e.key === "Enter" && pick(city)}>
                    <span>{city.name}</span>
                    {#if city.code < 100000}
                        <SvgIcon svgPaths={icon_chevron_right} size={20} />
                    {/if}
                </div>
            {/each}
        </div>
    </div>
{/if}

<style>
    .cityPicker { position: fixed; inset: 0; z-index: 1000; background: var(--raised-bg); display: flex; flex-direction: column; }
    .cityPicker > nav { display: flex; align-items: center; gap: 0; padding: 8px 12px; border-bottom: 1px solid var(--sunken-bg); overflow-x: auto; min-height: 44px; flex-shrink: 0; }
    .cityPicker > nav > div { cursor: pointer; white-space: nowrap; padding: 4px 0; color: var(--accent-color); font-size: 14px; flex-shrink: 0; }
    .cityPicker > nav > span { display: flex; align-items: center; color: var(--sunken-fg); flex-shrink: 0; }
    .cityPicker > nav > div:first-child { color: var(--sunken-fg); }
    .cityPicker > [role="region"] { flex: 1; overflow-y: auto; -webkit-overflow-scrolling: touch; }
    .cityPicker > [role="region"] > div { display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; cursor: pointer; border-bottom: 1px solid var(--sunken-bg); color: var(--raised-fg); font-size: 15px; }
    .cityPicker > [role="region"] > div:hover { background: var(--sunken-bg); }
</style>
