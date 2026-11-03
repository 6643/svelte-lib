<script module lang="ts">
	let count = $state(0);

	export const bump = (): void => {
		count += 1;
	};

	export const readCount = (): number => count;

	export type ProbeProps = { label: string };
</script>

<script lang="ts">
	let { label }: ProbeProps = $props();
</script>

<p data-probe>{label}:{readCount()}</p>
