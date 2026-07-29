<script lang="ts">
    type Props = {
        label: string;
        checked?: boolean;
        changed?: (checked: boolean) => void;
        disabled?: boolean;
    };
    let { label, checked = false, changed, disabled = false }: Props = $props();
</script>

<label class="btn">
    <input type="checkbox" {checked} onchange={(e) => changed?.((e.target as HTMLInputElement).checked)} {disabled} />
    <span>{label}</span>
</label>

<style>
    .btn {
        display: inline-flex; align-items: center; align-self: flex-start; gap: 8px;
        cursor: pointer; user-select: none; padding: 6px 12px;
        border: 2px solid var(--sunken-fg); border-radius: 3px;
        transition: border-color 160ms ease; overflow: hidden; position: relative;
    }
    .btn::before {
        content: ""; width: 100%; height: 100%; position: absolute; top: 0; left: 0;
        background-image: radial-gradient(circle, currentColor 10%, transparent 10%);
        background-size: 1000% 1000%; background-position: 50%;
        pointer-events: none; transition: 512ms; opacity: 0;
    }
    .btn:active::before { background-size: 0 0; opacity: 0.28; transition: none; }
    .btn input { position: absolute; opacity: 0; width: 0; height: 0; }
    .btn span { color: var(--sunken-fg); font-size: 14px; }
    .btn:has(input:checked) { border-color: var(--accent-color); opacity: 1; }
    .btn:has(input:checked) span { color: var(--accent-color); }
    .btn:has(input:disabled) { border-color: var(--disabled-color); cursor: not-allowed; }
    .btn:has(input:disabled) span { color: var(--disabled-color); }
</style>
