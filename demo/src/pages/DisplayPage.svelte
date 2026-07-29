<script lang="ts">
    import {
        Card,
        FlexBox,
        CountDown,
        Counter,
        TimeLine,
        AvatarImage,
        ListBox,
        SortListBox,
        CaptchaInput,
        Box,
    } from "svelte-lib";

    let counterVal = $state(1);
    let sortItems = $state([
        { id: 1, text: "学习 SolidJS" },
        { id: 2, text: "编写 UI 组件" },
        { id: 3, text: "创建 Demo 应用" },
        { id: 4, text: "测试组件功能" },
        { id: 5, text: "优化性能" },
    ]);

    const now = Math.floor(Date.now() / 1000);
    let timelineEvents = [
        { time: now - 3600, info: "1小时前的事件" },
        { time: now - 7200, info: "2小时前的事件" },
        { time: now - 86400, info: "昨天的事件" },
        { time: now - 172800, info: "前天的事件" },
        { time: now - 259200, info: "3天前的事件" },
        { time: now - 345600, info: "4天前的事件" },
    ];

    let listItems = Array.from({ length: 200 }, (_, i) => ({
        id: i + 1,
        name: `项目 ${i + 1}`,
        desc: `这是第 ${i + 1} 个项目的描述`,
    }));

    let listFilter = $state("");
    let listIndex = $state(0);
    let filteredItems = $derived(listFilter ? listItems.filter((item) => item.name.includes(listFilter)) : listItems);
    let code4 = $state("");
    let code6 = $state("");
</script>

<div class="page">
    <h1 class="title">展示组件</h1>
    <p class="desc">展示 CountDown、Counter、TimeLine、AvatarImage、ListBox、SortListBox</p>

    <FlexBox gap={16} wrap="wrap">
        <Card class="card">
            <h2 class="cardTitle">CountDown 倒计时</h2>
            <CountDown value={300} done={() => console.log("倒计时完成!")} />
            <p class="note">5分钟倒计时（300秒）</p>
        </Card>

        <Card class="card">
            <h2 class="cardTitle">Counter 计数器</h2>
            <Counter value={counterVal} change={(v) => (counterVal = v)} min={0} max={99} />
            <p class="note">当前值: {counterVal}（范围 0-99）</p>
        </Card>
    </FlexBox>

    <FlexBox gap={16} wrap="wrap">
        <Card class="card">
            <h2 class="cardTitle">AvatarImage 头像</h2>
            <FlexBox gap={12} wrap="wrap" ai="center">
                <AvatarImage src="https://api.dicebear.com/7.x/avataaars/svg?seed=1" size={32} color="blue" />
                <AvatarImage src="https://api.dicebear.com/7.x/avataaars/svg?seed=2" size={48} color="pink" />
                <AvatarImage src="https://api.dicebear.com/7.x/avataaars/svg?seed=3" size={64} color="white" />
                <AvatarImage src="https://api.dicebear.com/7.x/avataaars/svg?seed=4" size={128} color="gray" />
            </FlexBox>
        </Card>
    </FlexBox>

    <Card class="card">
        <h2 class="cardTitle">TimeLine 时间线</h2>
        <TimeLine title="最近活动" children={timelineEvents} visCount={3} />
    </Card>

    <Card class="card">
        <h2 class="cardTitle">ListBox 虚拟列表（200项）</h2>
        <FlexBox gap={8} ai="center" wrap="wrap" style="margin-bottom:8px">
            <div style="font-size:12px;color:var(--sunken-fg);align-self:flex-end;padding-bottom:8px">
                共 {filteredItems.length} 项
            </div>
        </FlexBox>
        <div class="container300">
            <ListBox items={filteredItems}>
                {#snippet children(item: any, i: number)}
                    <div class="listItem">
                        <strong>{item.name}</strong>
                        <span>{item.desc}</span>
                    </div>
                {/snippet}
            </ListBox>
        </div>
    </Card>

    <Card class="card">
        <h2 class="cardTitle">SortListBox 可排序列表</h2>
        <SortListBox
            items={sortItems}
            hookChange={(newItems: any[]) => {
                sortItems = newItems;
            }}
        >
            {#snippet renderItem(item: any)}
                <div class="sortItem">
                    <span class="sortItemId">#{item.id}</span>
                    <span>{item.text}</span>
                </div>
            {/snippet}
        </SortListBox>
    </Card>

    <FlexBox gap={16} wrap="wrap">
        <Card class="card">
            <h2 class="cardTitle">CaptchaInput 验证码（4位）</h2>
            <CaptchaInput label="短信验证码" length={4} value={code4} changed={(v) => (code4 = v)} />
            <p class="note">当前值: {code4 || "（未输入）"}</p>
        </Card>
        <Card class="card">
            <h2 class="cardTitle">CaptchaInput 验证码（6位）</h2>
            <CaptchaInput label="邮箱验证码" length={6} value={code6} changed={(v) => (code6 = v)} />
            <p class="note">当前值: {code6 || "（未输入）"}</p>
        </Card>
    </FlexBox>
</div>

<style>
    @import "./Pages.css";
</style>
