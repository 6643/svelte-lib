<script lang="ts">
    import {
        Block,
        FilledButton,
        FilledModal,
        StringInput,
        icon_house,
        icon_save,
    } from "svelte-lib/ui";
    import { routePush } from "svelte-lib/route";

    type Props = {
        name?: string;
    };

    let { name = "Ada Lovelace" }: Props = $props();

    let draftName = $state("");
    let saved = $state(false);

    $effect.pre(() => {
        draftName = name ?? "";
    });

    const validateName = (value: string) => value.trim() ? undefined : "Required";
    const goHome = () => routePush("/");
    const closeSaved = () => {
        saved = false;
    };
    const saveName = () => {
        const nextName = draftName.trim() || "Guest";
        routePush(`/profile?name=${encodeURIComponent(nextName)}`);
        saved = true;
    };
</script>

<Block headerTitle="Profile Editor" footerLeft="Decoded from ?name=">
    {#snippet headerActions()}
        <FilledButton icon={icon_house} text="Back Home" tap={goHome} />
    {/snippet}

    {#snippet children()}
        <div class="stack">
            <StringInput
                label="Display Name"
                value={draftName}
                changed={(value) => (draftName = value)}
                validate={validateName}
            />

            <div class="meta">
                <span>Decoded prop:</span>
                <strong>{name ?? "(empty)"}</strong>
            </div>

            <FilledButton icon={icon_save} text="Save To Query" tap={saveName} />

            <FilledModal active={saved} onClose={closeSaved}>
                {#snippet children()}
                    <section class="modal-card">
                        <h2>Saved</h2>
                        <p>
                            当前 query 已更新为
                            <code>?name={encodeURIComponent(draftName.trim() || "Guest")}</code>
                        </p>
                        <FilledButton text="Close" tap={closeSaved} />
                    </section>
                {/snippet}
            </FilledModal>
        </div>
    {/snippet}
</Block>

<style>
    .stack {
        display: flex;
        flex-direction: column;
        gap: 16px;
        padding: 8px 0;
    }

    .meta {
        display: flex;
        gap: 8px;
        align-items: center;
        flex-wrap: wrap;
    }

    .modal-card {
        background: var(--sb-color);
        color: var(--sf-color);
        border-radius: 12px;
        padding: 20px;
        display: flex;
        flex-direction: column;
        gap: 12px;
        box-shadow: 0 24px 70px rgba(0, 0, 0, 0.22);
    }

    .modal-card h2,
    .modal-card p {
        margin: 0;
    }

    .modal-card code {
        font-family:
            "IBM Plex Mono",
            monospace;
    }
</style>
