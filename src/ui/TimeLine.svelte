<script lang="ts">
    import SvgIcon from "./SvgIcon.svelte";
    import { icon_expand_all, icon_unfold_less } from "./svgicons";

    type EventItem = { time: number; info: string; url?: string };
    type Props = { title: string; children: EventItem[]; visCount?: number };

    let { title, children: events, visCount = 3 }: Props = $props();

    let collapsed = $derived(events.slice(0, visCount));
    let expanded = $state(false);
    let getEvents = $derived(expanded ? events : collapsed);

    const toggle = () => { expanded = !expanded; };

    const toRecentTime = (timestamp: number): string => {
        const now = new Date();
        const dt = new Date(timestamp * 1000);
        const currentYear = now.getFullYear();
        const todayStart = new Date(currentYear, now.getMonth(), now.getDate());
        const yesterdayStart = new Date(currentYear, now.getMonth(), now.getDate() - 1);
        const dtObj = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
        const hh = String(dt.getHours()).padStart(2, "0");
        const mm = String(dt.getMinutes()).padStart(2, "0");
        const t = `${hh}:${mm}`;
        const md = `${String(dt.getMonth()+1).padStart(2,"0")}-${String(dt.getDate()).padStart(2,"0")}`;
        const sy = String(dt.getFullYear()).slice(-2);
        if (dtObj.getTime() === todayStart.getTime()) return `今天 ${t}`;
        if (dtObj.getTime() === yesterdayStart.getTime()) return `昨天 ${t}`;
        if (dt.getFullYear() === currentYear) return `${md} ${t}`;
        return `${sy}-${md} ${t}`;
    };
</script>

<div class="timeLine">
    <div class="title">{title}</div>
    {#each getEvents as { time, info, url }}
        {#if url}
            <a href={url}><div class="item"><span></span><div><span>{toRecentTime(time)}</span><div>{info}</div></div></div></a>
        {:else}
            <div class="item"><span></span><div><span>{toRecentTime(time)}</span><div>{info}</div></div></div>
        {/if}
    {/each}
    {#if events.length > collapsed.length}
        <div class="toggle">
            <span></span>
            <button type="button" onclick={toggle}
                onkeydown={(e) => e.key === "Enter" && toggle()}>
                <span>{expanded ? "收起" : "展开"}</span>
                <SvgIcon svgPaths={expanded ? icon_unfold_less : icon_expand_all} color="var(--sunken-fg)" />
            </button>
        </div>
    {/if}
</div>

<style>
    .timeLine { background-color: var(--sunken-bg); padding: 8px 0; }
    .title { padding: 0 16px 8px; font-weight: 600; }
    .item { display: flex; }
    .item > div { padding-bottom: 8px; }
    .item > div > span { color: var(--sunken-fg); font-size: 12px; }
    .item > span { display: block; width: 9px; margin-right: 8px; position: relative; flex-shrink: 0; }
    .item > span::before { content: ""; display: block; width: 1px; height: 100%; background-color: var(--sunken-bg); position: absolute; left: 50%; transform: translateX(-50%); top: 8px; }
    .item > span::after { content: ""; display: block; width: 5px; height: 5px; border-radius: 50%; background-color: var(--accent-color); position: absolute; left: 50%; transform: translateX(-50%); top: 8px; }
    .item:last-of-type > span::before { display: none; }
    .toggle { display: flex; }
    .toggle > span { display: block; width: 9px; margin-right: 8px; position: relative; flex-shrink: 0; }
    .toggle > span::before { content: ""; display: block; width: 1px; height: 100%; background-color: var(--sunken-bg); position: absolute; left: 50%; transform: translateX(-50%); top: 8px; }
    .toggle > span::after { content: ""; display: block; width: 5px; height: 5px; border-radius: 50%; background-color: var(--accent-color); position: absolute; left: 50%; transform: translateX(-50%); top: 8px; }
    .toggle > button { cursor: pointer; display: flex; align-items: center; gap: 4px; padding-bottom: 8px; color: var(--sunken-fg); font-size: 13px; background: none; border: none; font: inherit; padding: 0 0 8px 0; }
</style>
