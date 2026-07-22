export const version = "native-v3";

if (import.meta.hot) {
    import.meta.hot.accept((nextModule) => {
        const target = document.querySelector("[data-native-hmr]");
        if (target) {
            target.textContent = nextModule?.version ?? "native-missing";
        }
    });
}
