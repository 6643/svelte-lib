export type ValidateResult = string | undefined | Promise<string | undefined>;

/**
 * 字段校验 hook（Svelte 5 rune 版）
 * 在组件 script 中调用：let { error, checking } = useField(() => value, validate);
 */
export const useValidation = (getValue: () => string, validate?: (value: string) => ValidateResult) => {
    let error = $state<string>();
    let checking = $state(false);
    let seq = 0;

    $effect(() => {
        const v = getValue();
        if (!validate) {
            error = undefined;
            return;
        }
        const id = ++seq;
        const result = validate(v);
        if (result instanceof Promise) {
            checking = true;
            result.then(msg => { if (id === seq) error = msg; })
                .finally(() => { if (id === seq) checking = false; });
            return;
        }
        error = result;
    });

    return {
        get error() { return error; },
        get checking() { return checking; },
    };
};
