<script lang="ts">
    import { Card, FlexBox, GridBox, StackBox, CenterBox, Box } from "svelte-lib";
</script>

<div class="page">
    <h1 class="title">布局组件</h1>
    <p class="desc">展示 FlexBox、GridBox、StackBox、CenterBox、Block 组件</p>

    <FlexBox gap={16} wrap="wrap">
        <Card class="card">
            <h2 class="cardTitle">FlexBox 弹性布局</h2>

            <h3 class="subTitle">水平排列 (row)</h3>
            <FlexBox gap={8} dir="row">
                <div class="box">1</div>
                <div class="box">2</div>
                <div class="box">3</div>
            </FlexBox>

            <h3 class="subTitle">垂直排列 (column)</h3>
            <FlexBox gap={8} dir="column">
                <div class="box">A</div>
                <div class="box">B</div>
                <div class="box">C</div>
            </FlexBox>

            <h3 class="subTitle">对齐方式</h3>
            <FlexBox gap={8} jc="space-between" ai="center" class="flexDemo">
                <div class="box">Start</div>
                <div class="box">Center</div>
                <div class="box">End</div>
            </FlexBox>

            <h3 class="subTitle">自动换行</h3>
            <FlexBox gap={8} wrap="wrap">
                <div class="box fixedW120">Item 1</div>
                <div class="box fixedW120">Item 2</div>
                <div class="box fixedW120">Item 3</div>
                <div class="box fixedW120">Item 4</div>
                <div class="box fixedW120">Item 5</div>
            </FlexBox>
        </Card>

        <Card class="card">
            <h2 class="cardTitle">GridBox 网格布局</h2>

            <h3 class="subTitle">基础网格</h3>
            <GridBox columns="1fr 1fr 1fr" gap={8}>
                <div class="box">1</div>
                <div class="box">2</div>
                <div class="box">3</div>
                <div class="box">4</div>
                <div class="box">5</div>
                <div class="box">6</div>
            </GridBox>

            <h3 class="subTitle">自定义区域</h3>
            <GridBox columns="1fr 2fr" rows="auto auto" areas="1,1;1,2;2,2" gap={8}>
                <div class="box">侧边栏</div>
                <div class="box" style="min-height:100px">主内容区</div>
                <div class="box">底部</div>
            </GridBox>
        </Card>
    </FlexBox>

    <FlexBox gap={16} wrap="wrap">
        <Card class="card">
            <h2 class="cardTitle">StackBox 堆叠布局</h2>
            <StackBox pos={[{x:0,y:0},{x:20,y:20},{x:40,y:40}]}>
                <div class="box" style="width:120px;height:80px;background:#e91e63">底层</div>
                <div class="box" style="width:120px;height:80px;background:#9c27b0">中层</div>
                <div class="box" style="width:120px;height:80px;background:#673ab7">顶层</div>
            </StackBox>
        </Card>

        <Card class="card">
            <h2 class="cardTitle">CenterBox 居中布局</h2>
            <div class="container200">
                <CenterBox><div class="box">居中内容</div></CenterBox>
            </div>
        </Card>
    </FlexBox>

    <Card class="card">
        <h2 class="cardTitle">Box 区块布局</h2>
        <FlexBox gap={16} wrap="wrap">
            <Box headerTitle="区块标题" footerLeft="左侧">
                <div class="pad16">这是 Box 组件的内容区域，支持 header 和 footer。</div>
            </Box>
            <Box headerTitle="无 Footer">
                <div class="pad16">这个 Box 没有 footer 部分。</div>
            </Box>
        </FlexBox>
    </Card>
</div>

<style>
    @import "./Pages.css";
</style>
