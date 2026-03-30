import type { LazyRouteDefinition, LazyRouteLoader } from './types.ts';

export const lazyRoute = (loader: LazyRouteLoader): LazyRouteDefinition => {
  if (typeof loader !== 'function') {
    throw new Error('lazyRoute loader must be a function');
  }

  if (loader.length !== 0) {
    throw new Error('lazyRoute loader must be a zero-argument function');
  }

  return {
    kind: 'lazy-route',
    load: loader
  };
};
