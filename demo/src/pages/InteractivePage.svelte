<script lang="ts">
    import { Card, FlexBox, Button, Expand, Modal } from "svelte-lib";

    let isBottomOpen = $state(false);
    let isTopOpen = $state(false);
    let isLeftOpen = $state(false);
    let isRightOpen = $state(false);
</script>

<div class="page">
    <h1 class="title">交互组件</h1>
    <p class="desc">展示 Modal、Expand 组件</p>

    <FlexBox gap={16} wrap="wrap">
        <Card class="card">
            <h2 class="cardTitle">Expand 折叠面板</h2>
            <FlexBox gap={8} dir="column">
                <Expand title="基础信息">
                    <div class="expandContent">
                        <p>这是折叠面板的内容区域。</p>
                        <p>可以放置任意内容。</p>
                    </div>
                </Expand>
                <Expand title="高级设置">
                    <div class="expandContent">
                        <p>这里是高级设置选项。</p>
                        <ul>
                            <li>选项 1</li>
                            <li>选项 2</li>
                            <li>选项 3</li>
                        </ul>
                    </div>
                </Expand>
            </FlexBox>
        </Card>

        <Card class="card">
            <h2 class="cardTitle">Bottom Modal</h2>
            <Button
                mode="filled"
                tap={() => {
                    isBottomOpen = true;
                }}><span>打开底部弹窗</span></Button
            >
            {#if isBottomOpen}
                <Modal
                    mode="bottom"
                    open={true}
                    onClose={() => {
                        isBottomOpen = false;
                    }}
                    height="60vh"
                >
                    <div class="modalContent">
                        <h2>底部弹窗</h2>
                        <p>从底部滑出的模态框。</p>
                        <Button
                            mode="filled"
                            tap={() => {
                                isBottomOpen = false;
                            }}><span>关闭</span></Button
                        >
                    </div>
                </Modal>
            {/if}
        </Card>
    </FlexBox>

    <FlexBox gap={16} wrap="wrap">
        <Card class="card">
            <h2 class="cardTitle">Top Modal</h2>
            <Button
                mode="outlined"
                tap={() => {
                    isTopOpen = true;
                }}><span>打开顶部弹窗</span></Button
            >
            {#if isTopOpen}
                <Modal
                    mode="top"
                    open={true}
                    onClose={() => {
                        isTopOpen = false;
                    }}
                >
                    <div class="modalContent">
                        <h2>顶部弹窗</h2>
                        <p>从上方落入的模态框。</p>
                        <Button
                            mode="filled"
                            tap={() => {
                                isTopOpen = false;
                            }}><span>关闭</span></Button
                        >
                    </div>
                </Modal>
            {/if}
        </Card>

        <Card class="card">
            <h2 class="cardTitle">Left Modal</h2>
            <Button
                mode="outlined"
                tap={() => {
                    isLeftOpen = true;
                }}><span>打开左侧弹窗</span></Button
            >
            {#if isLeftOpen}
                <Modal
                    mode="left"
                    open={true}
                    onClose={() => {
                        isLeftOpen = false;
                    }}
                >
                    <div class="modalContent">
                        <h2>左侧弹窗</h2>
                        <p>从左侧滑出的模态框。</p>
                        <Button
                            mode="filled"
                            tap={() => {
                                isLeftOpen = false;
                            }}><span>关闭</span></Button
                        >
                    </div>
                </Modal>
            {/if}
        </Card>
    </FlexBox>
</div>

<style>
    @import "./Pages.css";
</style>
