import {
  MAX_MANAGED_HISTORY_ENTRIES,
  buildPushState,
  buildReplaceState,
  createManagedHistoryOwner,
  createManagedRouteState,
  normalizeHistoryState
} from './history.ts';
import { normalizeNavigationTarget } from './navigation.ts';
import type { RouteDecoderMap, RouteEntry, RouteHistoryState } from './types.ts';

let initialized = false;
let currentPath = '/';
let historyOwner = createManagedHistoryOwner();
let historyState: RouteHistoryState = {
  __route: createManagedRouteState(
    {
      index: 0,
      stack: ['/']
    },
    historyOwner
  )
};
let entries: RouteEntry[] = [];
const listeners = new Set<() => void>();
let matchedRouteId: symbol | null = null;
let matchDirty = true;
let runtimeWindow: Window | null = null;
let runtimeHistory: History | null = null;
let originalPushState: History['pushState'] | null = null;
let originalReplaceState: History['replaceState'] | null = null;
let suppressPatchedHistorySync = false;
let historyStateReferences: unknown[] = [undefined];
let historyStateSnapshots: unknown[] = [undefined];
const MAX_HISTORY_STATE_SNAPSHOT_ARRAY_LENGTH = 128;
const MAX_HISTORY_STATE_SNAPSHOT_BINARY_BYTES = 16 * 1024;
const MAX_HISTORY_STATE_SNAPSHOT_MAP_SIZE = 64;
const MAX_HISTORY_STATE_SNAPSHOT_NODES = 256;
const MAX_HISTORY_STATE_SNAPSHOT_OBJECT_KEYS = 64;
const MAX_HISTORY_STATE_SNAPSHOT_SET_SIZE = 64;
const MAX_HISTORY_STATE_SNAPSHOT_STRING_LENGTH = 4 * 1024;

const invalidateRouteMatch = (): void => {
  matchDirty = true;
};

const readCurrentUrl = (): string => `${window.location.pathname}${window.location.search}${window.location.hash}` || '/';

const isPlainHistoryStateObject = (state: unknown): state is Record<string, unknown> => {
  if (!state || typeof state !== 'object') {
    return false;
  }

  const prototype = Object.getPrototypeOf(state);
  return prototype === Object.prototype || prototype === null;
};

const hasManagedRouteState = (state: unknown): state is { __route: unknown } =>
  !!state && typeof state === 'object' && '__route' in (state as Record<string, unknown>);

const canSnapshotHistoryState = (
  value: unknown,
  budget = { nodes: MAX_HISTORY_STATE_SNAPSHOT_NODES },
  visited = new WeakSet<object>()
): boolean => {
  budget.nodes -= 1;
  if (budget.nodes < 0) {
    return false;
  }

  if (value == null) {
    return true;
  }

  if (typeof value === 'string') {
    return value.length <= MAX_HISTORY_STATE_SNAPSHOT_STRING_LENGTH;
  }

  if (typeof value !== 'object') {
    return typeof value !== 'function' && typeof value !== 'symbol';
  }

  if (visited.has(value as object)) {
    return true;
  }

  visited.add(value as object);

  if (value instanceof Date || value instanceof RegExp) {
    return true;
  }

  if (ArrayBuffer.isView(value)) {
    return value.byteLength <= MAX_HISTORY_STATE_SNAPSHOT_BINARY_BYTES;
  }

  if (value instanceof ArrayBuffer) {
    return value.byteLength <= MAX_HISTORY_STATE_SNAPSHOT_BINARY_BYTES;
  }

  if (Array.isArray(value)) {
    return value.length <= MAX_HISTORY_STATE_SNAPSHOT_ARRAY_LENGTH && value.every((entry) => canSnapshotHistoryState(entry, budget, visited));
  }

  if (value instanceof Map) {
    if (value.size > MAX_HISTORY_STATE_SNAPSHOT_MAP_SIZE) {
      return false;
    }

    for (const [entryKey, entryValue] of value.entries()) {
      if (!canSnapshotHistoryState(entryKey, budget, visited) || !canSnapshotHistoryState(entryValue, budget, visited)) {
        return false;
      }
    }

    return true;
  }

  if (value instanceof Set) {
    if (value.size > MAX_HISTORY_STATE_SNAPSHOT_SET_SIZE) {
      return false;
    }

    for (const entry of value.values()) {
      if (!canSnapshotHistoryState(entry, budget, visited)) {
        return false;
      }
    }

    return true;
  }

  const keys = Reflect.ownKeys(value);
  if (keys.length > MAX_HISTORY_STATE_SNAPSHOT_OBJECT_KEYS) {
    return false;
  }

  for (const key of keys) {
    if (!canSnapshotHistoryState((value as Record<PropertyKey, unknown>)[key], budget, visited)) {
      return false;
    }
  }

  return true;
};

const cloneHistoryStateSnapshot = (state: unknown): unknown => {
  if (!canSnapshotHistoryState(state)) {
    return undefined;
  }

  if (typeof structuredClone === 'function') {
    try {
      return structuredClone(state);
    } catch {
      return undefined;
    }
  }

  return undefined;
};

const areHistoryStateSnapshotsEqual = (
  left: unknown,
  right: unknown,
  visited = new WeakMap<object, WeakMap<object, true>>()
): boolean => {
  if (Object.is(left, right)) {
    return true;
  }

  if (!left || !right || typeof left !== 'object' || typeof right !== 'object') {
    return false;
  }

  let seenRight = visited.get(left as object);
  if (seenRight?.has(right as object)) {
    return true;
  }

  if (!seenRight) {
    seenRight = new WeakMap<object, true>();
    visited.set(left as object, seenRight);
  }

  seenRight.set(right as object, true);

  if (left instanceof Date || right instanceof Date) {
    return left instanceof Date && right instanceof Date && left.getTime() === right.getTime();
  }

  if (left instanceof RegExp || right instanceof RegExp) {
    return left instanceof RegExp && right instanceof RegExp && left.source === right.source && left.flags === right.flags;
  }

  if (left instanceof Map || right instanceof Map) {
    if (!(left instanceof Map) || !(right instanceof Map) || left.size !== right.size) {
      return false;
    }

    const leftEntries = [...left.entries()];
    const rightEntries = [...right.entries()];
    for (let index = 0; index < leftEntries.length; index += 1) {
      const [leftKey, leftValue] = leftEntries[index];
      const [rightKey, rightValue] = rightEntries[index];
      if (!areHistoryStateSnapshotsEqual(leftKey, rightKey, visited) || !areHistoryStateSnapshotsEqual(leftValue, rightValue, visited)) {
        return false;
      }
    }

    return true;
  }

  if (left instanceof Set || right instanceof Set) {
    if (!(left instanceof Set) || !(right instanceof Set) || left.size !== right.size) {
      return false;
    }

    const leftValues = [...left.values()];
    const rightValues = [...right.values()];
    for (let index = 0; index < leftValues.length; index += 1) {
      if (!areHistoryStateSnapshotsEqual(leftValues[index], rightValues[index], visited)) {
        return false;
      }
    }

    return true;
  }

  if (ArrayBuffer.isView(left) || ArrayBuffer.isView(right)) {
    if (!ArrayBuffer.isView(left) || !ArrayBuffer.isView(right) || left.constructor !== right.constructor || left.byteLength !== right.byteLength) {
      return false;
    }

    const leftBytes = new Uint8Array(left.buffer, left.byteOffset, left.byteLength);
    const rightBytes = new Uint8Array(right.buffer, right.byteOffset, right.byteLength);
    for (let index = 0; index < leftBytes.length; index += 1) {
      if (leftBytes[index] !== rightBytes[index]) {
        return false;
      }
    }

    return true;
  }

  if (left instanceof ArrayBuffer || right instanceof ArrayBuffer) {
    if (!(left instanceof ArrayBuffer) || !(right instanceof ArrayBuffer) || left.byteLength !== right.byteLength) {
      return false;
    }

    const leftBytes = new Uint8Array(left);
    const rightBytes = new Uint8Array(right);
    for (let index = 0; index < leftBytes.length; index += 1) {
      if (leftBytes[index] !== rightBytes[index]) {
        return false;
      }
    }

    return true;
  }

  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) {
      return false;
    }

    for (let index = 0; index < left.length; index += 1) {
      if (!areHistoryStateSnapshotsEqual(left[index], right[index], visited)) {
        return false;
      }
    }

    return true;
  }

  if (Object.getPrototypeOf(left) !== Object.getPrototypeOf(right)) {
    return false;
  }

  const leftKeys = Reflect.ownKeys(left);
  const rightKeys = Reflect.ownKeys(right);
  if (leftKeys.length !== rightKeys.length) {
    return false;
  }

  for (const key of leftKeys) {
    if (!rightKeys.includes(key)) {
      return false;
    }

    if (
      !areHistoryStateSnapshotsEqual(
        (left as Record<PropertyKey, unknown>)[key],
        (right as Record<PropertyKey, unknown>)[key],
        visited
      )
    ) {
      return false;
    }
  }

  return true;
};

const notify = (): void => {
  for (const listener of listeners) {
    listener();
  }
};

const withPatchedHistorySyncSuppressed = (run: () => void): void => {
  const previous = suppressPatchedHistorySync;
  suppressPatchedHistorySync = true;

  try {
    run();
  } finally {
    suppressPatchedHistorySync = previous;
  }
};

const ensureBrowser = (): void => {
  if (
    typeof window === 'undefined' ||
    typeof document === 'undefined' ||
    typeof history === 'undefined' ||
    typeof location === 'undefined'
  ) {
    throw new Error('svelte-route requires a browser environment');
  }
};

const readCurrentPath = (): string => `${window.location.pathname}${window.location.search}` || '/';

const getCurrentPathname = (): string => currentPath.split('?')[0] || '/';

const findMatchedRouteId = (routeEntries: RouteEntry[]): symbol | null => {
  const pathname = getCurrentPathname();
  let fallbackId: symbol | null = null;

  for (let index = routeEntries.length - 1; index >= 0; index -= 1) {
    const entry = routeEntries[index];

    if (entry.path === pathname) {
      return entry.id;
    }

    if (fallbackId == null && entry.path === '*') {
      fallbackId = entry.id;
    }
  }

  return fallbackId;
};

const createRuntimeHistoryState = (browserState: unknown, route: RouteHistoryState['__route']): RouteHistoryState => {
  if (isPlainHistoryStateObject(browserState)) {
    return {
      ...browserState,
      __route: route
    };
  }

  return {
    __route: route
  };
};

const clampHistoryStateEntries = <T>(entries: T[], index: number): { index: number; entries: T[] } => {
  if (entries.length <= MAX_MANAGED_HISTORY_ENTRIES) {
    return {
      index,
      entries: entries.slice()
    };
  }

  const centeredStart = index - Math.floor((MAX_MANAGED_HISTORY_ENTRIES - 1) / 2);
  const maxStart = entries.length - MAX_MANAGED_HISTORY_ENTRIES;
  const start = Math.max(0, Math.min(centeredStart, maxStart));

  return {
    index: index - start,
    entries: entries.slice(start, start + MAX_MANAGED_HISTORY_ENTRIES)
  };
};

const replaceHistoryReferenceAtIndex = (index: number, reference: unknown): unknown[] => {
  const nextReferences = historyStateReferences.slice();
  nextReferences[index] = reference;
  return nextReferences;
};

const replaceHistorySnapshotAtIndex = (index: number, snapshot: unknown): unknown[] => {
  const nextSnapshots = historyStateSnapshots.slice();
  nextSnapshots[index] = snapshot;
  return nextSnapshots;
};

const pushHistoryReference = (reference: unknown): unknown[] => {
  const nextIndex = historyState.__route.index + 1;
  const nextReferences = [...historyStateReferences.slice(0, nextIndex), reference];
  return clampHistoryStateEntries(nextReferences, nextIndex).entries;
};

const pushHistorySnapshot = (snapshot: unknown): unknown[] => {
  const nextIndex = historyState.__route.index + 1;
  const nextSnapshots = [...historyStateSnapshots.slice(0, nextIndex), snapshot];
  return clampHistoryStateEntries(nextSnapshots, nextIndex).entries;
};

const selectNearestHistoryIndex = (candidates: number[]): number | null => {
  if (candidates.length === 0) {
    return null;
  }

  const preferredCandidates = candidates.length > 1 ? candidates.filter((candidate) => candidate !== historyState.__route.index) : candidates;
  const activeCandidates = preferredCandidates.length > 0 ? preferredCandidates : candidates;
  let nearestIndex = activeCandidates[0];
  let nearestDistance = Math.abs(nearestIndex - historyState.__route.index);
  let nearestCount = 1;

  for (const candidate of activeCandidates.slice(1)) {
    const distance = Math.abs(candidate - historyState.__route.index);
    if (distance < nearestDistance) {
      nearestIndex = candidate;
      nearestDistance = distance;
      nearestCount = 1;
      continue;
    }

    if (distance === nearestDistance) {
      nearestCount += 1;
    }
  }

  return nearestCount === 1 ? nearestIndex : null;
};

const findNearestKnownRouteIndex = (nextPath: string, nextHistoryState: unknown): number | null => {
  const referenceMatches: number[] = [];
  const exactMatches: number[] = [];
  const pathMatches: number[] = [];

  for (let index = 0; index < historyState.__route.stack.length; index += 1) {
    if (historyState.__route.stack[index] !== nextPath) {
      continue;
    }

    pathMatches.push(index);

    if (Object.is(historyStateReferences[index], nextHistoryState)) {
      referenceMatches.push(index);
      continue;
    }

    if (areHistoryStateSnapshotsEqual(historyStateSnapshots[index], nextHistoryState)) {
      exactMatches.push(index);
    }
  }

  const referenceIndex = selectNearestHistoryIndex(referenceMatches);
  if (referenceIndex != null) {
    return referenceIndex;
  }

  const exactIndex = selectNearestHistoryIndex(exactMatches);
  if (exactIndex != null) {
    return exactIndex;
  }

  const pathIndex = selectNearestHistoryIndex(pathMatches);
  if (pathIndex != null) {
    return pathIndex;
  }

  return null;
};

const reconcileManagedRouteState = (nextPath: string, nextHistoryState: unknown): RouteHistoryState['__route'] => {
  const nearestIndex = findNearestKnownRouteIndex(nextPath, nextHistoryState);
  if (nearestIndex != null) {
    return createManagedRouteState(
      {
        index: nearestIndex,
        stack: historyState.__route.stack
      },
      historyOwner
    );
  }

  return createManagedRouteState(
    {
      index: 0,
      stack: [nextPath]
    },
    historyOwner
  );
};

const syncRuntimeFromBrowser = (nextHistoryState: unknown): boolean => {
  const nextPath = readCurrentPath();
  const pathChanged = nextPath !== currentPath;
  const nextSnapshot = cloneHistoryStateSnapshot(nextHistoryState);

  if (!hasManagedRouteState(nextHistoryState)) {
    const previousRouteState = historyState.__route;
    const nextRouteState = reconcileManagedRouteState(nextPath, nextHistoryState);
    historyState = createRuntimeHistoryState(nextHistoryState, nextRouteState);
    historyStateReferences =
      nextRouteState.stack.length === previousRouteState.stack.length &&
      nextRouteState.stack.every((path, index) => path === previousRouteState.stack[index])
        ? replaceHistoryReferenceAtIndex(nextRouteState.index, nextHistoryState)
        : Array.from({ length: nextRouteState.stack.length }, (_, index) => (index === nextRouteState.index ? nextHistoryState : undefined));
    historyStateSnapshots =
      nextRouteState.stack.length === previousRouteState.stack.length &&
      nextRouteState.stack.every((path, index) => path === previousRouteState.stack[index])
        ? replaceHistorySnapshotAtIndex(nextRouteState.index, nextSnapshot)
        : Array.from({ length: nextRouteState.stack.length }, (_, index) => (index === nextRouteState.index ? nextSnapshot : undefined));
    currentPath = nextPath;

    if (pathChanged) {
      invalidateRouteMatch();
    }

    return false;
  }

  const previousRouteState = historyState.__route;
  const normalizedState = normalizeHistoryState(nextHistoryState, nextPath, historyOwner);
  historyStateReferences =
    normalizedState.__route.stack.length === previousRouteState.stack.length &&
    normalizedState.__route.stack.every((path, index) => path === previousRouteState.stack[index])
      ? replaceHistoryReferenceAtIndex(normalizedState.__route.index, nextHistoryState)
      : Array.from({ length: normalizedState.__route.stack.length }, (_, index) => (index === normalizedState.__route.index ? nextHistoryState : undefined));
  historyStateSnapshots =
    normalizedState.__route.stack.length === previousRouteState.stack.length &&
    normalizedState.__route.stack.every((path, index) => path === previousRouteState.stack[index])
      ? replaceHistorySnapshotAtIndex(normalizedState.__route.index, nextSnapshot)
      : Array.from({ length: normalizedState.__route.stack.length }, (_, index) => (index === normalizedState.__route.index ? nextSnapshot : undefined));
  currentPath = nextPath;
  historyState = normalizedState;

  if (pathChanged) {
    invalidateRouteMatch();
  }

  return nextHistoryState !== normalizedState;
};

const commitHistoryState = (kind: 'push' | 'replace', state: RouteHistoryState, url: string): void => {
  withPatchedHistorySyncSuppressed(() => {
    if (kind === 'push') {
      (originalPushState ?? history.pushState).call(history, state, '', url);
      return;
    }

    (originalReplaceState ?? history.replaceState).call(history, state, '', url);
  });
};

const syncRuntimeFromExternalHistoryMutation = (kind: 'push' | 'replace', previousUrl: string): void => {
  const nextPath = readCurrentPath();
  const nextUrl = readCurrentUrl();
  const pathChanged = nextPath !== currentPath;
  const hashOnlyChange = !pathChanged && previousUrl !== nextUrl;
  const nextSnapshot = cloneHistoryStateSnapshot(history.state);

  if (!pathChanged && (kind === 'replace' || hashOnlyChange)) {
    historyState = createRuntimeHistoryState(history.state, historyState.__route);
    historyStateReferences = replaceHistoryReferenceAtIndex(historyState.__route.index, history.state);
    historyStateSnapshots = replaceHistorySnapshotAtIndex(historyState.__route.index, nextSnapshot);
    return;
  }

  const nextRouteState = kind === 'push' ? buildPushState(historyState, nextPath, historyOwner) : buildReplaceState(historyState, nextPath, historyOwner);
  const nextState = createRuntimeHistoryState(history.state, nextRouteState.__route);

  currentPath = nextPath;
  historyState = nextState;
  historyStateReferences = kind === 'push' ? pushHistoryReference(history.state) : replaceHistoryReferenceAtIndex(historyState.__route.index, history.state);
  historyStateSnapshots = kind === 'push' ? pushHistorySnapshot(nextSnapshot) : replaceHistorySnapshotAtIndex(historyState.__route.index, nextSnapshot);

  if (pathChanged) {
    invalidateRouteMatch();
    notify();
  }
};

const handlePopState = (event: PopStateEvent): void => {
  ensureBrowser();

  const repaired = syncRuntimeFromBrowser(event.state);
  if (repaired) {
    commitHistoryState('replace', historyState, readCurrentUrl());
  }

  notify();
};

const restorePatchedHistory = (): void => {
  if (runtimeHistory) {
    if (originalPushState) {
      runtimeHistory.pushState = originalPushState;
    }

    if (originalReplaceState) {
      runtimeHistory.replaceState = originalReplaceState;
    }
  }

  runtimeHistory = null;
  originalPushState = null;
  originalReplaceState = null;
  suppressPatchedHistorySync = false;
};

const patchRuntimeHistory = (): void => {
  if (runtimeHistory === history) {
    return;
  }

  restorePatchedHistory();
  runtimeHistory = history;
  originalPushState = history.pushState;
  originalReplaceState = history.replaceState;

  history.pushState = ((data: unknown, unused: string, url?: string | URL | null): void => {
    const previousUrl = readCurrentUrl();
    originalPushState?.call(history, data, unused, url);

    if (!suppressPatchedHistorySync) {
      syncRuntimeFromExternalHistoryMutation('push', previousUrl);
    }
  }) as History['pushState'];

  history.replaceState = ((data: unknown, unused: string, url?: string | URL | null): void => {
    const previousUrl = readCurrentUrl();
    originalReplaceState?.call(history, data, unused, url);

    if (!suppressPatchedHistorySync) {
      syncRuntimeFromExternalHistoryMutation('replace', previousUrl);
    }
  }) as History['replaceState'];
};

const bindRuntimeWindow = (): void => {
  if (runtimeWindow === window && runtimeHistory === history) {
    return;
  }

  runtimeWindow?.removeEventListener('popstate', handlePopState);
  restorePatchedHistory();
  window.addEventListener('popstate', handlePopState);
  patchRuntimeHistory();
  runtimeWindow = window;
};

const ensureRuntime = (): void => {
  ensureBrowser();

  if (initialized) {
    return;
  }

  const repaired = syncRuntimeFromBrowser(history.state);
  if (repaired) {
    history.replaceState(historyState, '', readCurrentUrl());
  }

  bindRuntimeWindow();
  initialized = true;
};

export const initRouteSystem = (): void => {
  ensureRuntime();
};

const navigate = (kind: 'push' | 'replace', target: string): void => {
  ensureRuntime();

  const nextPath = normalizeNavigationTarget(target, currentPath, window.location.origin);
  const nextUrl = target === '?' || target.startsWith('?') ? `${nextPath}${window.location.hash}` : nextPath;
  if (nextPath === currentPath) {
    return;
  }

  const nextState =
    kind === 'push' ? buildPushState(historyState, nextPath, historyOwner) : buildReplaceState(historyState, nextPath, historyOwner);

  commitHistoryState(kind, nextState, nextUrl);

  currentPath = nextPath;
  historyState = nextState;
  historyStateReferences = kind === 'push' ? pushHistoryReference(nextState) : replaceHistoryReferenceAtIndex(historyState.__route.index, nextState);
  historyStateSnapshots =
    kind === 'push' ? pushHistorySnapshot(cloneHistoryStateSnapshot(nextState)) : replaceHistorySnapshotAtIndex(historyState.__route.index, cloneHistoryStateSnapshot(nextState));
  invalidateRouteMatch();
  notify();
};

export const subscribeRuntime = (update: () => void): (() => void) => {
  listeners.add(update);

  return () => {
    listeners.delete(update);
  };
};

export const registerRoute = (entry: RouteEntry): (() => void) => {
  ensureRuntime();
  const previousMatch = getMatchedRouteId();
  entries = [...entries, entry];
  invalidateRouteMatch();
  const nextMatch = getMatchedRouteId();

  if (nextMatch !== previousMatch) {
    notify();
  }

  return () => {
    const previousMatch = getMatchedRouteId();
    entries = entries.filter((candidate) => candidate.id !== entry.id);
    invalidateRouteMatch();
    const nextMatch = getMatchedRouteId();

    if (nextMatch !== previousMatch) {
      notify();
    }
  };
};

export const getMatchedRouteId = (): symbol | null => {
  if (!matchDirty) {
    return matchedRouteId;
  }

  matchedRouteId = findMatchedRouteId(entries);
  matchDirty = false;
  return matchedRouteId;
};

export const getCurrentSearch = (): string => currentPath.includes('?') ? `?${currentPath.split('?').slice(1).join('?')}` : '';

export const routePush = (path: string): void => {
  navigate('push', path);
};

export const routeReplace = (path: string): void => {
  navigate('replace', path);
};

export const routeCurrentPath = (): string => {
  ensureRuntime();
  return currentPath;
};

export const routeBackPath = (): string | null => {
  ensureRuntime();
  return historyState.__route.stack[historyState.__route.index - 1] ?? null;
};

export const routeForwardPath = (): string | null => {
  ensureRuntime();
  return historyState.__route.stack[historyState.__route.index + 1] ?? null;
};

export const __createRouteHistoryStateForTest = (route: {
  index: number;
  stack: string[];
}): RouteHistoryState['__route'] => createManagedRouteState(route, historyOwner);

export const __createRouteHistorySnapshotForTest = (state: unknown): unknown => cloneHistoryStateSnapshot(state);

export const __resetRouteSystemForTest = (): void => {
  runtimeWindow?.removeEventListener('popstate', handlePopState);
  restorePatchedHistory();
  runtimeWindow = null;
  initialized = false;
  currentPath = '/';
  historyOwner = createManagedHistoryOwner();
  historyStateReferences = [undefined];
  historyStateSnapshots = [undefined];
  entries = [];
  listeners.clear();
  matchedRouteId = null;
  matchDirty = true;
  historyState = {
    __route: createManagedRouteState(
      {
        index: 0,
        stack: ['/']
      },
      historyOwner
    )
  };
};
