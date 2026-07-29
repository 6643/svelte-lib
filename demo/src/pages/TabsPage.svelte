<script lang="ts">
    import { Card, FlexBox, Counter } from "svelte-lib";

    let topIndex = $state(0);
    let menuIndex = $state(0);
    let leftIndex = $state(0);
</script>

<div class="page">
    <h1 class="title">Tab 组件</h1>
    <p class="desc">展示标签页组件示例</p>

    <Card class="card">
        <h2 class="cardTitle">TopTab 标签页</h2>
        <div class="tab-bar">
            <button type="button" class:active={topIndex === 0} onclick={() => topIndex = 0}>标签一</button>
            <button type="button" class:active={topIndex === 1} onclick={() => topIndex = 1}>标签二</button>
            <button type="button" class:active={topIndex === 2} onclick={() => topIndex = 2}>标签三</button>
        </div>
        <div class="tabPanel">
            {#if topIndex === 0}
                <h3>标签一内容</h3><p>固定标签页。</p><Counter min={0} max={99} />
            {:else if topIndex === 1}
                <h3>标签二内容</h3><p>第二个标签页。</p>
            {:else}
                <h3>标签三内容</h3><p>第三个标签页。</p>
            {/if}
        </div>
    </Card>

    <Card class="card">
        <h2 class="cardTitle">MenuTab 菜单标签页</h2>
        <div class="tab-bar">
            <button type="button" class:active={menuIndex === 0} onclick={() => menuIndex = 0}>首页</button>
            <button type="button" class:active={menuIndex === 1} onclick={() => menuIndex = 1}>设置</button>
            <button type="button" class:active={menuIndex === 2} onclick={() => menuIndex = 2}>关于</button>
        </div>
        <div class="tabPanel">
            {#if menuIndex === 0}<h3>首页</h3><p>欢迎页面内容。</p>
            {:else if menuIndex === 1}<h3>设置</h3><p>设置页面内容。</p>
            {:else}<h3>关于</h3><p>关于页面内容。</p>{/if}
        </div>
    </Card>

    <Card class="card">
        <h2 class="cardTitle">LeftTab 侧栏标签页</h2>
        <div style="display:flex;height:200px">
            <div class="left-nav">
                <button type="button" class:active={leftIndex === 0} onclick={() => leftIndex = 0}>文件</button>
                <button type="button" class:active={leftIndex === 1} onclick={() => leftIndex = 1}>编辑</button>
                <button type="button" class:active={leftIndex === 2} onclick={() => leftIndex = 2}>视图</button>
            </div>
            <div class="tabPanel" style="flex:1">
                {#if leftIndex === 0}<h3>文件</h3><p>文件管理内容。</p>
                {:else if leftIndex === 1}<h3>编辑</h3><p>编辑内容。</p>
                {:else}<h3>视图</h3><p>视图设置。</p>{/if}
            </div>
        </div>
    </Card>
</div>

<style>
    @import "./Pages.css";
    .tab-bar { display: flex; gap: 0; border-bottom: 2px solid var(--disabled-color); }
    .tab-bar button { background: none; border: none; padding: 8px 16px; cursor: pointer; color: var(--sunken-fg); border-bottom: 2px solid transparent; margin-bottom: -2px; font-family: inherit; font-size: 14px; transition: color 160ms ease, border-color 160ms ease; }
    .tab-bar button.active { color: var(--accent-color); border-bottom-color: var(--accent-color); }
    .left-nav { width: 64px; background: var(--sunken-bg); padding: 8px 0; flex-shrink: 0; }
    .left-nav button { display: block; width: 100%; padding: 10px 4px; background: none; border: none; cursor: pointer; color: var(--sunken-fg); font-size: 12px; text-align: center; font-family: inherit; }
    .left-nav button.active { color: var(--accent-color); background: color-mix(in srgb, var(--accent-color) 10%, transparent); }
</style>
