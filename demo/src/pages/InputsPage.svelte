<script lang="ts">
    import {
        Card,
        FlexBox,
        TextInput,
        TextArea,
        PasswordInput,
        NumberInput,
        RangeInput,
        CheckButton,
        RadioButton,
        CaptchaInput,
        Button,
    } from "svelte-lib";
    import { icon_add, icon_remove, icon_search, icon_close } from "svelte-lib";

    let name = $state("张三");
    let email = $state("");
    let phone = $state("");
    let age = $state(25);
    let bio = $state("这是一段简介文本...");
    let volume = $state(50);
    let search = $state("");
    let qty = $state(1);
    let agree = $state(false);
    let gender = $state("male");
    let code4 = $state("");
    let code6 = $state("");

    const validateEmail = (value: string) => {
        if (!value) return "邮箱不能为空";
        if (!value.includes("@")) return "请输入有效的邮箱地址";
        return undefined;
    };

    const checkEmailRemote = async (value: string) => {
        if (!value || !value.includes("@")) return undefined;
        await new Promise((r) => setTimeout(r, 800));
        return value === "taken@example.com" ? "该邮箱已被注册" : undefined;
    };
</script>

<div class="page">
    <h1 class="title">输入组件</h1>
    <p class="desc">TextInput、PasswordInput、NumberInput、RangeInput</p>

    <FlexBox gap={16} wrap="wrap">
        <Card class="card">
            <h2 class="cardTitle">TextInput 单行</h2>
            <FlexBox gap={16} dir="column">
                <TextInput label="姓名" value={name} changed={(v) => (name = v)} />
                <TextInput label="只读" value="不可编辑" />
            </FlexBox>
        </Card>

        <Card class="card">
            <h2 class="cardTitle">SearchInput 搜索</h2>
            <FlexBox gap={16} dir="column">
                <TextInput label="搜索" value={search} changed={(v) => (search = v)} />
                <p class="note">当前: {search || "（空）"}</p>
            </FlexBox>
        </Card>
    </FlexBox>

    <FlexBox gap={16} wrap="wrap">
        <Card class="card">
            <h2 class="cardTitle">NumberInput 数字</h2>
            <FlexBox gap={16} dir="column">
                <NumberInput label="年龄" value={age} changed={(v) => (age = v)} min={0} max={150} />
                <NumberInput label="数量" value={qty} changed={(v) => (qty = v)} min={1} max={99} />
            </FlexBox>
        </Card>

        <Card class="card">
            <h2 class="cardTitle">RangeInput 滑块</h2>
            <RangeInput label="音量" value={volume} changed={(v) => (volume = v)} min={0} max={100} unit="%" />
            <p class="note">当前: {volume}%</p>
        </Card>
    </FlexBox>

    <FlexBox gap={16} wrap="wrap">
        <Card class="card">
            <h2 class="cardTitle">PasswordInput 密码</h2>
            <PasswordInput label="密码" />
        </Card>

        <Card class="card">
            <h2 class="cardTitle">TextArea 多行</h2>
            <TextArea label="简介" value={bio} changed={(v) => (bio = v)} row={4} />
        </Card>
    </FlexBox>

    <FlexBox gap={16} wrap="wrap">
        <Card class="card">
            <h2 class="cardTitle">CheckButton 勾选</h2>
            <FlexBox gap={8} dir="column">
                <CheckButton label="同意条款" checked={agree} changed={(v) => (agree = v)} />
                <CheckButton label="禁用" disabled />
                <p class="note">勾选状态: {agree ? "✓" : "✗"}</p>
            </FlexBox>
        </Card>

        <Card class="card">
            <h2 class="cardTitle">RadioButton 单选</h2>
            <FlexBox gap={8} dir="column">
                <RadioButton label="男" value="male" checked={gender === "male"} changed={(v) => (gender = v)} name="gender" />
                <RadioButton
                    label="女"
                    value="female"
                    checked={gender === "female"}
                    changed={(v) => (gender = v)}
                    name="gender"
                />
                <RadioButton
                    label="其他"
                    value="other"
                    checked={gender === "other"}
                    changed={(v) => (gender = v)}
                    name="gender"
                    disabled
                />
                <p class="note">选择: {gender}</p>
            </FlexBox>
        </Card>
    </FlexBox>

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
