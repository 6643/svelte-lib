<script lang="ts">
    import { version } from "./hmr-probe.ts";

    const browserState = globalThis as typeof globalThis & { __nativeHmrBoots?: number };
    browserState.__nativeHmrBoots = (browserState.__nativeHmrBoots ?? 0) + 1;
</script>

<h1 data-native-hmr>{version}</h1>

<style>
    h1 {
        color: rgb(10, 20, 30);
    }
</style>
