import type { LazyRouteDefinition, SyncRouteComponent } from './types.ts';

export const isPromiseLike = (value: unknown): value is PromiseLike<unknown> =>
  !!value && (typeof value === 'object' || typeof value === 'function') && typeof (value as { then?: unknown }).then === 'function';

export const isLazyRouteDefinition = (value: unknown): value is LazyRouteDefinition =>
  !!value &&
  typeof value === 'object' &&
  (value as { kind?: unknown }).kind === 'lazy-route' &&
  typeof (value as { load?: unknown }).load === 'function';

export const resolveLazyRouteComponent = (module: unknown): SyncRouteComponent => {
  const resolvedDefault = module && typeof module === 'object' ? (module as { default?: unknown }).default : undefined;

  if (typeof resolvedDefault !== 'function') {
    throw new Error('Lazy route component must resolve to a module with a default component export');
  }

  return resolvedDefault as SyncRouteComponent;
};
