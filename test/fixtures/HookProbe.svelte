<script lang="ts">
	import { useClickOutside } from '../../src/hooks/useClickOutside.ts';
	import { useKeyPress } from '../../src/hooks/useKeyPress.svelte.ts';
	import { useTap, useLongPress } from '../../src/hooks/useGestures.ts';
	import { useMutation } from '../../src/hooks/useMutation.ts';
	import { useRefresh } from '../../src/hooks/useRefresh.ts';

	type Props = {
		className?: string;
		onOutside?: () => void;
		onKey?: (event: KeyboardEvent) => void;
		onTap?: () => void;
		onLongPress?: () => void;
		onMutate?: () => void;
		onRefresh?: () => Promise<void>;
	};

	let {
		className,
		onOutside,
		onKey,
		onTap,
		onLongPress,
		onMutate,
		onRefresh
	}: Props = $props();

	// 只有传了回调才挂附件; 附件在调用点读回调, 换回调会重挂
	useKeyPress('Enter', (event) => onKey?.(event));
</script>

<div
	class="box"
	{@attach useClickOutside(() => onOutside?.())}
	{@attach useRefresh(() => onRefresh?.() ?? Promise.resolve())}
	data-class={className}
>
	<div
		class="target"
		{@attach useTap(() => onTap?.())}
		{@attach useLongPress(() => onLongPress?.())}
		{@attach useMutation(() => onMutate?.(), { childList: true })}
	>
		target
	</div>
</div>
