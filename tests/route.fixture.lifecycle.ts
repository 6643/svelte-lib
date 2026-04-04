export const lifecycle = {
  syncAMounts: 0,
  syncADestroys: 0
};

export const resetLifecycle = (): void => {
  lifecycle.syncAMounts = 0;
  lifecycle.syncADestroys = 0;
};
