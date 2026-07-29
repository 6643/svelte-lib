<script lang="ts">
    import { Card, FlexBox, Button, TextInput, Counter } from "svelte-lib";
    import { ThemeToggle } from "svelte-lib";
</script>

<div class="page">
    <h1 class="title">主题设置</h1>
    <p class="desc">切换亮暗模式，选择强调色</p>

    <Card class="card">
        <h2 class="cardTitle">亮暗模式</h2>
        <FlexBox gap={16} ai="center">
            <ThemeToggle />
            <span class="note">点击切换</span>
        </FlexBox>
    </Card>

    <Card class="card">
        <h2 class="cardTitle">组件预览</h2>
        <FlexBox gap={16} dir="column">
            <FlexBox gap={8} wrap="wrap">
                <Button mode="filled"><span>强调按钮</span></Button>
                <Button mode="outlined"><span>描边按钮</span></Button>
                <Button mode="text" text="文字按钮" />
            </FlexBox>
            <TextInput label="输入框" value="示例文本" />
            <Counter value={42} min={0} max={99} />
        </FlexBox>
    </Card>

    <Card class="card">
        <h2 class="cardTitle">色彩层级</h2>
        <FlexBox gap={8} dir="column">
            <div class="colorSwatch" style="background:var(--base-bg);color:var(--raised-fg)">base — 卡片、容器</div>
            <div class="colorSwatch" style="background:var(--raised-bg);color:var(--raised-fg)">raised — 按钮、凸起</div>
            <div class="colorSwatch" style="background:var(--sunken-bg);color:var(--sunken-fg)">sunken — 输入框、凹陷</div>
            <div class="colorSwatch" style="background:var(--disabled-color);color:var(--raised-fg)">disabled — 禁用状态</div>
        </FlexBox>
    </Card>
</div>

<style>
    @import "./Pages.css";
</style>
