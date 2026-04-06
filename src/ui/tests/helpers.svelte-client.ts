import { flushSync, mount, unmount, type Component, type ComponentProps } from "svelte";

export { flushSync };

export const svelteMount = <TComponent extends Component<any>>(
    component: TComponent,
    options: { target: Document | Element | ShadowRoot; props?: ComponentProps<TComponent> },
) => mount(component, options);

export const svelteUnmount = unmount;
