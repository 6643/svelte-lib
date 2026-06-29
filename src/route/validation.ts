import type { LazyRouteLoader, RouteComponent, RouteDecoder, RouteDecoderMap } from './types.ts';

type RouteConfigInput = Record<string, unknown> & {
  path: unknown;
  component: unknown;
};

export type ValidatedRouteConfig = {
  path: string;
  component: RouteComponent;
  decoders: RouteDecoderMap;
  lazyLoader: LazyRouteLoader | null;
};

export const isRouteDecoder = (value: unknown): value is RouteDecoder =>
  value === String || value === Number || value === Boolean || typeof value === 'function';

export const isRoutePath = (path: string): boolean =>
  path === '*' ||
  (path.startsWith('/') &&
    !path.startsWith('//') &&
    !path.includes('?') &&
    !path.includes('#') &&
    !path.split('/').some((segment) => segment === '.' || segment === '..'));

export const isLazyRouteLoader = (value: unknown): value is LazyRouteLoader =>
  typeof value === 'function' && value.length === 0;

export const validateRouteConfig = (input: Record<string, unknown>): ValidatedRouteConfig => {
  const config = input as RouteConfigInput;

  if (typeof config.path !== 'string') {
    throw new Error('Route path must be a string');
  }

  if (!isRoutePath(config.path)) {
    throw new Error('Route path must be "*" or an absolute pathname without query or hash');
  }

  const decoders = {} as RouteDecoderMap;
  const isLazyLoader = isLazyRouteLoader(config.component);

  if (!isLazyLoader && typeof config.component !== 'function') {
    throw new Error('Invalid Route component');
  }

  for (const key in config) {
    if (key === 'path' || key === 'component') {
      continue;
    }

    if (!key.startsWith('$')) {
      throw new Error(`Unsupported Route config: ${key}`);
    }

    const decoder = config[key];
    if (!isRouteDecoder(decoder)) {
      throw new Error(`Invalid Route decoder: ${key}`);
    }

    decoders[key as keyof RouteDecoderMap] = decoder;
  }

  return {
    path: config.path,
    component: config.component as RouteComponent,
    decoders,
    lazyLoader: isLazyLoader ? (config.component as LazyRouteLoader) : null,
  };
};
