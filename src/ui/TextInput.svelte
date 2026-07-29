<script lang="ts">
    import { useValidation } from "../util/useValidation.svelte.ts";

    type ValidateResult = string | undefined | Promise<string | undefined>;

    type Props = {
        label: string;
        value?: string;
        changed?: (value: string) => void;
        placeholder?: string;
        disabled?: boolean;
        minLen?: number;
        maxLen?: number;
        validate?: (value: string) => ValidateResult;
    };

    let { label, value: _val, changed, placeholder, disabled = false, minLen, maxLen, validate }: Props = $props();
    let value = $derived(_val ?? "");
    let { error, checking } = useValidation(() => value, validate);
    let hasError = $derived(!!error);
</script>

<label class="field" class:error={hasError}>
    <div>
        <span>{label}</span>
        <span class="fieldError">{checking ? "校验中..." : (error ?? "")}</span>
    </div>
    <div class="inputWrap">
        <div class="inputGrow">
            <input
                type="text"
                inputmode="text"
                {placeholder}
                value={value}
                oninput={(e) => changed?.((e.target as HTMLInputElement).value)}
                spellcheck={false}
                readonly={!changed}
                {disabled}
                minlength={minLen}
                maxlength={maxLen}
            />
        </div>
    </div>
</label>

<style>
    .field { display: flex; flex-direction: column; }
    .field > div:first-child { display: flex; justify-content: space-between; align-items: center; }
    .inputWrap {
        display: flex; align-items: center; gap: 4px; width: 100%; height: 40px;
        background: var(--base-bg); border: 2px solid transparent; border-radius: 3px;
        transition: border-color 160ms ease;
    }
    .inputWrap:has(input:focus) { border-color: var(--accent-color); }
    .field.error .inputWrap { border-color: var(--error-color); }
    .inputGrow { flex: 1; min-width: 0; }
    .inputGrow input {
        appearance: none; background: transparent; border: none; color: inherit;
        box-shadow: none; outline: 0; width: 100%; box-sizing: border-box;
        padding: 0 8px; line-height: 36px;
    }
    .inputGrow input:disabled { color: var(--sunken-fg); cursor: not-allowed; }
    .inputGrow input::placeholder { color: var(--disabled-color); }
    .fieldError { color: var(--error-color); }
</style>
