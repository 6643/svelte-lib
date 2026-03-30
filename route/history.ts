import type { RouteHistoryState } from './types.ts';

type ManagedRouteSnapshot = Omit<RouteHistoryState['__route'], 'signature'>;

const DEFAULT_HISTORY_OWNER = 'svelte-route';
export const MAX_MANAGED_HISTORY_ENTRIES = 100;

export const createManagedHistoryOwner = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
};

const computeManagedRouteSignature = (owner: string, route: ManagedRouteSnapshot): string => {
  const input = `${owner}:${route.index}:${route.stack.join('\u0001')}`;
  let hash = 2166136261;

  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return `v1-${(hash >>> 0).toString(16)}`;
};

const signManagedRouteState = (route: ManagedRouteSnapshot, owner: string): RouteHistoryState['__route'] => ({
  ...route,
  signature: computeManagedRouteSignature(owner, route)
});

export const createManagedRouteState = (
  route: ManagedRouteSnapshot,
  owner = DEFAULT_HISTORY_OWNER
): RouteHistoryState['__route'] => signManagedRouteState(clampManagedRouteState(route), owner);

const buildInitialRouteState = (currentPath: string, owner: string): RouteHistoryState['__route'] =>
  createManagedRouteState(
    {
      index: 0,
      stack: [currentPath]
    },
    owner
  );

const isManagedStackEntry = (value: unknown): value is string => typeof value === 'string' && value.startsWith('/');

const isValidManagedRouteShape = (route: unknown, currentPath: string): route is RouteHistoryState['__route'] => {
  if (!route || typeof route !== 'object') {
    return false;
  }

  const index = (route as { index?: unknown }).index;
  const stack = (route as { stack?: unknown }).stack;
  const signature = (route as { signature?: unknown }).signature;

  if (!Number.isInteger(index) || !Array.isArray(stack) || stack.length === 0 || typeof signature !== 'string') {
    return false;
  }

  const routeIndex = index as number;
  const routeStack = stack as unknown[];

  if (routeIndex < 0 || routeIndex >= routeStack.length) {
    return false;
  }

  if (!routeStack.every(isManagedStackEntry)) {
    return false;
  }

  return routeStack[routeIndex] === currentPath;
};

const clampManagedRouteState = (route: ManagedRouteSnapshot): ManagedRouteSnapshot => {
  if (route.stack.length <= MAX_MANAGED_HISTORY_ENTRIES) {
    return {
      index: route.index,
      stack: route.stack.slice()
    };
  }

  const centeredStart = route.index - Math.floor((MAX_MANAGED_HISTORY_ENTRIES - 1) / 2);
  const maxStart = route.stack.length - MAX_MANAGED_HISTORY_ENTRIES;
  const start = Math.max(0, Math.min(centeredStart, maxStart));

  return {
    index: route.index - start,
    stack: route.stack.slice(start, start + MAX_MANAGED_HISTORY_ENTRIES)
  };
};

const isTrustedManagedRouteState = (route: unknown, currentPath: string, owner: string): route is RouteHistoryState['__route'] => {
  if (!isValidManagedRouteShape(route, currentPath)) {
    return false;
  }

  const snapshot = {
    index: route.index,
    stack: route.stack
  } satisfies ManagedRouteSnapshot;

  return route.signature === computeManagedRouteSignature(owner, snapshot);
};

export const normalizeHistoryState = (state: unknown, currentPath: string, owner = DEFAULT_HISTORY_OWNER): RouteHistoryState => {
  if (state && typeof state === 'object') {
    const output = state as Record<string, unknown>;
    const route = output.__route;

    if (isTrustedManagedRouteState(route, currentPath, owner)) {
      const normalizedRoute = createManagedRouteState(
        {
          index: route.index,
          stack: route.stack
        },
        owner
      );

      if (
        normalizedRoute.index === route.index &&
        normalizedRoute.stack.length === route.stack.length &&
        normalizedRoute.signature === route.signature
      ) {
        return state as RouteHistoryState;
      }

      return {
        ...output,
        __route: normalizedRoute
      };
    }

    return {
      ...output,
      __route: buildInitialRouteState(currentPath, owner)
    };
  }

  return {
    __route: buildInitialRouteState(currentPath, owner)
  };
};

export const buildPushState = (prev: RouteHistoryState, nextPath: string, owner = DEFAULT_HISTORY_OWNER): RouteHistoryState => {
  const nextIndex = prev.__route.index + 1;
  const nextRoute = clampManagedRouteState({
    index: nextIndex,
    stack: [...prev.__route.stack.slice(0, nextIndex), nextPath]
  });

  return {
    ...prev,
    __route: createManagedRouteState(nextRoute, owner)
  };
};

export const buildReplaceState = (prev: RouteHistoryState, nextPath: string, owner = DEFAULT_HISTORY_OWNER): RouteHistoryState => {
  const nextStack = prev.__route.stack.slice();
  nextStack[prev.__route.index] = nextPath;
  const nextRoute = clampManagedRouteState({
    index: prev.__route.index,
    stack: nextStack
  });

  return {
    ...prev,
    __route: createManagedRouteState(nextRoute, owner)
  };
};
