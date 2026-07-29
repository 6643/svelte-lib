<script lang="ts">
    import { Button, Card, FlexBox } from "svelte-lib";
    import {
        icon_add, icon_remove, icon_favorite, icon_star, icon_check, icon_close,
        icon_search, icon_settings, icon_home, icon_person,
        icon_light_mode, icon_dark_mode, icon_computer, icon_brightness_auto,
        icon_settings_brightness, icon_contrast, icon_desktop_windows, icon_desktop_mac,
        icon_devices, icon_monitor, icon_laptop_chromebook,
    } from "svelte-lib";

    let count = $state(0);
</script>

<div class="page">
    <h1 class="title">按钮组件</h1>
    <p class="desc">展示所有按钮变体：FilledButton、OutlinedButton、TextButton、IconButton</p>

    <FlexBox gap={16} wrap="wrap">
        <Card class="card">
            <h2 class="cardTitle">Filled Buttons</h2>
            <FlexBox gap={8} wrap="wrap">
                <Button mode="filled"><span>默认</span></Button>
                <Button mode="filled" disabled><span>禁用</span></Button>
                <Button mode="filled" bgColor="#e91e63"><span>自定义颜色</span></Button>
                <Button mode="filled" borderRadius={20}><span>圆角</span></Button>
                <Button mode="filled" tap={() => { count++; }}><span>点击 {count}</span></Button>
                <Button mode="filled" tap={() => new Promise(r => setTimeout(r, 1000))}><span>异步操作</span></Button>
            </FlexBox>
        </Card>

        <Card class="card">
            <h2 class="cardTitle">Outlined Buttons</h2>
            <FlexBox gap={8} wrap="wrap">
                <Button mode="outlined"><span>默认</span></Button>
                <Button mode="outlined" disabled><span>禁用</span></Button>
                <Button mode="outlined" color="#4caf50"><span>自定义颜色</span></Button>
                <Button mode="outlined" borderRadius={20}><span>圆角</span></Button>
                <Button mode="outlined" tap={() => new Promise(r => setTimeout(r, 1000))}><span>异步操作</span></Button>
            </FlexBox>
        </Card>
    </FlexBox>

        <Card class="card">
            <h2 class="cardTitle">Text Buttons</h2>
            <FlexBox gap={8} wrap="wrap">
                <Button mode="text" text="默认" />
                <Button mode="text" text="禁用" disabled />
                <Button mode="text" text="自定义颜色" color="#ff9800" />
                <Button mode="text" text="带图标" iconPaths={icon_search} />
            </FlexBox>
        </Card>

        <Card class="card">
            <h2 class="cardTitle">Icon Buttons</h2>
            <FlexBox gap={8} wrap="wrap">
                <Button mode="icon" svgPaths={icon_add} />
                <Button mode="icon" svgPaths={icon_remove} />
                <Button mode="icon" svgPaths={icon_favorite} />
                <Button mode="icon" svgPaths={icon_star} />
                <Button mode="icon" svgPaths={icon_check} />
                <Button mode="icon" svgPaths={icon_close} />
                <Button mode="icon" svgPaths={icon_search} />
                <Button mode="icon" svgPaths={icon_settings} />
                <Button mode="icon" svgPaths={icon_home} />
                <Button mode="icon" svgPaths={icon_person} />
                <Button mode="icon" svgPaths={icon_add} disabled />
            </FlexBox>
        </Card>

        <Card class="card">
            <h2 class="cardTitle">主题 / 设备图标</h2>
            <FlexBox gap={8} wrap="wrap">
                <Button mode="icon" svgPaths={icon_light_mode} />
                <Button mode="icon" svgPaths={icon_dark_mode} />
                <Button mode="icon" svgPaths={icon_computer} />
                <Button mode="icon" svgPaths={icon_brightness_auto} />
                <Button mode="icon" svgPaths={icon_settings_brightness} />
                <Button mode="icon" svgPaths={icon_contrast} />
                <Button mode="icon" svgPaths={icon_desktop_windows} />
                <Button mode="icon" svgPaths={icon_desktop_mac} />
                <Button mode="icon" svgPaths={icon_devices} />
                <Button mode="icon" svgPaths={icon_monitor} />
                <Button mode="icon" svgPaths={icon_laptop_chromebook} />
            </FlexBox>
        </Card>

    <Card class="card">
        <h2 class="cardTitle">按钮尺寸</h2>
        <FlexBox gap={8} ai="center">
            <Button mode="filled" height={28}><span>小</span></Button>
            <Button mode="filled"><span>默认</span></Button>
            <Button mode="filled" height={48}><span>大</span></Button>
            <Button mode="filled" width={200}><span>宽按钮</span></Button>
        </FlexBox>
    </Card>
</div>

<style>
    @import "./Pages.css";
</style>
