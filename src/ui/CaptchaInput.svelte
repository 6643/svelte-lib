<script lang="ts">
    import { useValidation } from "../util/useValidation.svelte.ts";
    import type { ValidateResult } from "../util/useValidation.svelte.ts";
    import { icon_content_paste } from "./svgicons";
    import Button from "./Button.svelte";

    type Props = {
        label: string;
        length?: number;
        value?: string;
        changed?: (value: string) => void;
        disabled?: boolean;
        pattern?: RegExp;
        validate?: (value: string) => ValidateResult;
    };

    let { label, length: len = 6, value: _val, changed, disabled = false, pattern = /^\w$/, validate }: Props = $props();
    let val = $derived(_val ?? "");
    let { error, checking } = useValidation(() => val, validate);
    let hasError = $derived(!!error);

    const handleInput = (e: Event) => {
        const current = _val ?? "";
        const input = e.currentTarget as HTMLInputElement;
        const ie = e as InputEvent;
        if (ie.inputType === "deleteContentBackward") { changed?.(current.slice(0, -1)); return; }
        if (ie.inputType === "insertText" && ie.data) {
            if (current.length >= len) { input.value = current; return; }
            const ch = [...ie.data!].find(c => pattern.test(c));
            if (!ch) { input.value = current; return; }
            const next = current + ch;
            changed?.(next); input.value = next;
            input.setSelectionRange(next.length, next.length);
            return;
        }
        if (ie.inputType === "insertFromPaste") {
            const text = input.value;
            const matched = [...text].filter(c => pattern.test(c)).slice(0, len);
            const result = matched.join("");
            input.value = result; changed?.(result);
            input.setSelectionRange(result.length, result.length);
            return;
        }
        input.value = current;
    };

    const handlePaste = async () => {
        try {
            const text = await navigator.clipboard.readText();
            const matched = [...text].filter(c => pattern.test(c)).slice(0, len);
            changed?.(matched.join(""));
        } catch {
            // 用户未授权剪贴板读取，忽略
        }
    };
</script>

<label class="field" class:error={hasError}>
    <div>
        <span>{label}</span>
        <span class="fieldError">{checking ? "校验中..." : (error ?? "")}</span>
    </div>
    <div class="inputWrap">
        <div class="inputGrow">
            <input class="captchaInput" type="text" inputmode="numeric"
                maxlength={len} value={val} oninput={handleInput}
                {disabled} autocomplete="one-time-code" spellcheck={false}
                style="--len: {len}" />
        </div>
        <Button mode="icon" tap={handlePaste} svgPaths={icon_content_paste} {disabled} />
    </div>
</label>

<style>
    .field { display: flex; flex-direction: column; }
    .field > div:first-child { display: flex; justify-content: space-between; align-items: center; }
    .inputWrap { display: flex; align-items: center; gap: 4px; width: 100%; height: 40px; background: var(--base-bg); border: 2px solid transparent; border-radius: 3px; transition: border-color 160ms ease; }
    .inputWrap:has(input:focus) { border-color: var(--accent-color); }
    .field.error .inputWrap { border-color: var(--error-color); }
    .inputGrow { flex: 1; min-width: 0; }
    .inputGrow input { appearance: none; background: transparent; border: none; color: inherit; box-shadow: none; outline: 0; width: 100%; box-sizing: border-box; padding: 0 8px; line-height: 36px; }
    input.captchaInput { letter-spacing: 4px; font-family: monospace; font-style: italic; color: var(--raised-fg); }
    input.captchaInput:disabled { color: var(--disabled-color); cursor: not-allowed; }
    .fieldError { color: var(--error-color); }
</style>
