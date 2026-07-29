<script lang="ts">
    type Props = {
        /** 图片 URL */
        src: string;
        /** 头像尺寸 */
        size?: 32 | 48 | 64 | 128;
        /** 在线状态边框颜色 */
        color?: "blue" | "pink" | "white" | "gray";
    };

    let { src, size, color }: Props = $props();

    const borderColor = $derived(
        color === "blue" ? "#00AEEC" :
        color === "pink" ? "#fb7299" :
        color === "white" ? "white" :
        undefined
    );
</script>

<img {src} class="avatar" style:--size={size} style:--color={borderColor} alt="" />

<style>
    .avatar {
        border-radius: 50%;
        width: calc(1px * var(--size, 48));
        height: calc(1px * var(--size, 48));
        border: 3px solid var(--color, var(--sunken-bg));
    }
</style>
