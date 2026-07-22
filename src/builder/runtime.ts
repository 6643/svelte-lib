export const MOUNT_TARGET_MODULE = "svelte-lib/runtime";

export type MountTargetScope = Pick<Document, "createElement" | "getElementById"> & {
    body: HTMLElement | null;
};

export const mountId = "app";

export const getMountTarget = (scope: MountTargetScope = document): Element => {
    let target = scope.getElementById(mountId);
    if (target) return target;

    const body = scope.body;
    if (!body) throw new Error("Cannot create mount target before document.body exists");

    target = scope.createElement("div");
    target.id = mountId;
    body.append(target);
    return target;
};
