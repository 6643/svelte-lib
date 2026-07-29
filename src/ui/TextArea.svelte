<script lang="ts">
    type ValidateResult = string | undefined | Promise<string | undefined>;

    type Props = {
        label: string;
        value?: string;
        changed?: (value: string) => void;
        disabled?: boolean;
        minLen?: number;
        maxLen?: number;
        validate?: (value: string) => ValidateResult;
        /** 行数，默认 5 */
        row?: number;
        /** 显示行号，默认 true */
        lineNumbers?: boolean;
    };

    let { label, value: _val, changed, disabled = false, minLen, maxLen, validate, row = 5, lineNumbers = true }: Props = $props();
    let val = $derived(_val ?? "");

    // 校验
    let error = $state<string>();
    let checking = $state(false);
    let seq = 0;
    $effect(() => {
        if (!validate) { error = undefined; return; }
        const id = ++seq;
        const result = validate(val);
        if (result instanceof Promise) {
            checking = true;
            result.then(msg => { if (id === seq) error = msg; }).finally(() => { if (id === seq) checking = false; });
        } else { error = result; }
    });
    let hasError = $derived(!!error);

    let lineNumEl = $state<HTMLDivElement>();
    let textareaEl = $state<HTMLTextAreaElement>();

    $effect(() => {
        if (!lineNumEl) return;
        const c = val ? val.split("\n").length : 1;
        let text = "";
        for (let i = 1; i <= c; i++) text += i + "\n";
        lineNumEl.innerText = text;
    });

    const syncScroll = () => {
        if (lineNumEl && textareaEl) lineNumEl.scrollTop = textareaEl.scrollTop;
    };
</script>

<label class="field" class:error={hasError}>
    <div>
        <span>{label}</span>
        <span class="fieldError">{checking ? "校验中..." : (error ?? "")}</span>
    </div>
    <div class="inputWrap">
        <div class="inputGrow">
            {#if lineNumbers}
                <div class="editorWrap">
                    <div class="lineNumbers" bind:this={lineNumEl}>1</div>
                    <textarea
                        bind:this={textareaEl}
                        class="editorTextarea"
                        inputmode="text"
                        value={val}
                        oninput={(e) => changed?.((e.target as HTMLTextAreaElement).value)}
                        placeholder=" "
                        spellcheck={false}
                        readonly={!changed}
                        {disabled}
                        minlength={minLen}
                        maxlength={maxLen}
                        rows={row}
                        onscroll={syncScroll}
                    ></textarea>
                </div>
            {:else}
                <textarea
                    inputmode="text"
                    value={val}
                    oninput={(e) => changed?.((e.target as HTMLTextAreaElement).value)}
                    placeholder=" "
                    spellcheck={false}
                    readonly={!changed}
                    {disabled}
                    minlength={minLen}
                    maxlength={maxLen}
                    rows={row}
                ></textarea>
            {/if}
        </div>
    </div>
</label>

<style>
    .field { display: flex; flex-direction: column; }
    .field > div:first-child { display: flex; justify-content: space-between; align-items: center; }
    .inputWrap {
        display: flex; align-items: center; gap: 4px; width: 100%;
        background: var(--base-bg); border: 2px solid transparent; border-radius: 3px;
        transition: border-color 160ms ease;
    }
    .inputWrap:has(textarea:focus) { border-color: var(--accent-color); }
    .field.error .inputWrap { border-color: var(--error-color); }
    .inputGrow { flex: 1; min-width: 0; }
    .inputGrow textarea {
        appearance: none; background: transparent; border: none; color: inherit;
        box-shadow: none; outline: 0; width: 100%; box-sizing: border-box;
        padding: 11px 8px; line-height: 1.5; resize: vertical;
        font-size: inherit; font-family: inherit;
    }
    .inputGrow textarea:disabled { color: var(--sunken-fg); cursor: not-allowed; }
    .fieldError { color: var(--error-color); }

    .editorWrap { display: flex; align-items: stretch; width: 100%; }
    .lineNumbers {
        overflow: hidden; user-select: none; text-align: right; padding: 11px 8px;
        min-width: 2.4em; color: var(--sunken-fg); font-size: inherit; line-height: 1.5;
        white-space: pre; border-right: 1px solid color-mix(in srgb, var(--sunken-fg) 20%, transparent);
        opacity: 0.6; box-sizing: border-box;
    }
    .editorTextarea { flex: 1; min-width: 0; }
</style>
