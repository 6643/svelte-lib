<script lang="ts">
	// 边框色约定: 在线男性蓝, 在线女性粉, 离线灰; 其它情况用主题的 inset 背景色
	type Props = {
		src: string;
		size?: 32 | 48 | 64 | 128;
		color?: 'blue' | 'pink' | 'gray';
	};

	let { src, size, color }: Props = $props();

	const borderColor = $derived(
		color === 'blue' ? '#00AEEC' : color === 'pink' ? '#fb7299' : undefined
	);
</script>

<img {src} class="avatar-image" style:--size={size} style:--color={borderColor} alt="" />

<style>
	.avatar-image {
		border-radius: 50%;
		width: calc(1px * var(--size, 48));
		height: calc(1px * var(--size, 48));
		border: 3px solid var(--color, var(--inset-bg));
	}
</style>
