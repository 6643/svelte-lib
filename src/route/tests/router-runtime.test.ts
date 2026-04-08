import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { JSDOM } from 'jsdom';

import { createManagedRouteState } from '../history.ts';
import {
  __createRouteHistoryStateForTest,
  __resetRouteSystemForTest,
  getMatchedRouteId,
  initRouteSystem,
  registerRoute,
  routeBackPath,
  routeCurrentPath,
  routePush,
  routeReplace,
  subscribeRuntime
} from '../router.svelte.ts';

let cleanupDom = () => {};

const installDom = (path: string) => {
  const dom = new JSDOM('<!doctype html><html><body></body></html>', {
    url: `https://app.test${path}`
  });

  const previous = {
    window: globalThis.window,
    document: globalThis.document,
    history: globalThis.history,
    location: globalThis.location
  };

  globalThis.window = dom.window as never;
  globalThis.document = dom.window.document as never;
  globalThis.history = dom.window.history as never;
  globalThis.location = dom.window.location as never;

  return () => {
    globalThis.window = previous.window;
    globalThis.document = previous.document;
    globalThis.history = previous.history;
    globalThis.location = previous.location;
    dom.window.close();
  };
};

const replaceHistoryStateWithoutRuntimeSync = (state: unknown, url: string) => {
  const replaceState = Object.getPrototypeOf(history).replaceState as History['replaceState'];
  replaceState.call(history, state, '', url);
};

beforeEach(() => {
  cleanupDom = installDom('/a');
  __resetRouteSystemForTest();
});

afterEach(() => {
  __resetRouteSystemForTest();
  cleanupDom();
});

describe('router runtime', () => {
  test('routePush and routeReplace update location accessors', () => {
    expect(routeCurrentPath()).toBe('/a');

    routePush('/b');
    expect(routeCurrentPath()).toBe('/b');
    expect(routeBackPath()).toBe('/a');

    routeReplace('/b?id=1');
    expect(routeCurrentPath()).toBe('/b?id=1');
    expect(routeBackPath()).toBe('/a');
  });

  test('popstate restores router-managed current path and back path', () => {
    routePush('/b');

    replaceHistoryStateWithoutRuntimeSync(
      {
        __route: __createRouteHistoryStateForTest({
          index: 0,
          stack: ['/a', '/b']
        })
      },
      '/a'
    );
    window.dispatchEvent(new window.PopStateEvent('popstate', { state: history.state }));

    expect(routeCurrentPath()).toBe('/a');
    expect(routeBackPath()).toBeNull();
  });

  test('same path no-op keeps back path unchanged', () => {
    routePush('/a');

    expect(routeCurrentPath()).toBe('/a');
    expect(routeBackPath()).toBeNull();
  });

  test('throws on bare relative and cross origin inputs', () => {
    expect(() => routePush('foo')).toThrow(/Relative navigation/);
    expect(() => routeReplace('https://elsewhere.test/a')).toThrow(/Cross-origin/);
    expect(() => routePush('https://app.test//elsewhere.test/evil?x=1')).toThrow(/pathname starting with \/\//);
  });

  test('throws outside browser', () => {
    cleanupDom();
    cleanupDom = () => {};
    __resetRouteSystemForTest();

    expect(() => routeCurrentPath()).toThrow(/browser environment/);
    expect(() => routeBackPath()).toThrow(/browser environment/);
    expect(() => routePush('/b')).toThrow(/browser environment/);
    expect(() => routeReplace('/b')).toThrow(/browser environment/);
  });

  test('initialization preserves the current hash fragment', () => {
    cleanupDom();
    cleanupDom = installDom('/a?id=1#frag');
    __resetRouteSystemForTest();

    expect(window.location.hash).toBe('#frag');
    expect(routeCurrentPath()).toBe('/a?id=1');
    expect(window.location.hash).toBe('#frag');
    expect(window.location.href).toBe('https://app.test/a?id=1#frag');
  });

  test('query only navigation preserves the current hash fragment', () => {
    cleanupDom();
    cleanupDom = installDom('/a?id=1#frag');
    __resetRouteSystemForTest();

    routePush('?id=2');
    expect(routeCurrentPath()).toBe('/a?id=2');
    expect(window.location.hash).toBe('#frag');
    expect(window.location.href).toBe('https://app.test/a?id=2#frag');

    routeReplace('?id=3');
    expect(routeCurrentPath()).toBe('/a?id=3');
    expect(window.location.hash).toBe('#frag');
    expect(window.location.href).toBe('https://app.test/a?id=3#frag');
  });

  test('bare question mark push clears search while preserving the current hash fragment', () => {
    cleanupDom();
    cleanupDom = installDom('/a?id=1#frag');
    __resetRouteSystemForTest();

    routePush('?');
    expect(routeCurrentPath()).toBe('/a');
    expect(routeBackPath()).toBe('/a?id=1');
    expect(window.location.hash).toBe('#frag');
    expect(window.location.href).toBe('https://app.test/a#frag');
  });

  test('bare question mark replace clears search while preserving the current hash fragment', () => {
    cleanupDom();
    cleanupDom = installDom('/a?id=1#frag');
    __resetRouteSystemForTest();

    routeReplace('?');
    expect(routeCurrentPath()).toBe('/a');
    expect(routeBackPath()).toBeNull();
    expect(window.location.hash).toBe('#frag');
    expect(window.location.href).toBe('https://app.test/a#frag');
  });

  test('hash-only navigation targets are ignored as no-ops', () => {
    cleanupDom();
    cleanupDom = installDom('/a?id=1#start');
    __resetRouteSystemForTest();

    routePush('#next');
    expect(routeCurrentPath()).toBe('/a?id=1');
    expect(routeBackPath()).toBeNull();
    expect(window.location.href).toBe('https://app.test/a?id=1#start');

    routeReplace('#other');
    expect(routeCurrentPath()).toBe('/a?id=1');
    expect(routeBackPath()).toBeNull();
    expect(window.location.href).toBe('https://app.test/a?id=1#start');
  });

  test('native hash-only history mutations do not change route helpers', () => {
    cleanupDom();
    cleanupDom = installDom('/a?id=1#start');
    __resetRouteSystemForTest();

    expect(routeCurrentPath()).toBe('/a?id=1');

    history.pushState({ foo: 1 }, '', '#next');
    expect(routeCurrentPath()).toBe('/a?id=1');
    expect(routeBackPath()).toBeNull();
    expect((history.state as { foo?: number }).foo).toBe(1);
    expect(window.location.href).toBe('https://app.test/a?id=1#next');

    history.replaceState({ foo: 2 }, '', '#other');
    expect(routeCurrentPath()).toBe('/a?id=1');
    expect(routeBackPath()).toBeNull();
    expect((history.state as { foo?: number }).foo).toBe(2);
    expect(window.location.href).toBe('https://app.test/a?id=1#other');
  });

  test('popstate into malformed router managed state clears managed back path without rewriting payloads', () => {
    replaceHistoryStateWithoutRuntimeSync(
      {
        foo: 1,
        __route: {
          index: -1,
          stack: [42]
        }
      },
      '/a'
    );
    window.dispatchEvent(new window.PopStateEvent('popstate', { state: history.state }));

    expect(routeCurrentPath()).toBe('/a');
    expect(routeBackPath()).toBeNull();
    expect((history.state as { foo?: number }).foo).toBe(1);
  });

  test('native history.pushState does not synchronize runtime helpers', () => {
    expect(routeCurrentPath()).toBe('/a');

    const state = { foo: 1 };
    history.pushState(state, '', '/b?x=1');

    expect(routeCurrentPath()).toBe('/a');
    expect(routeBackPath()).toBeNull();
    expect(history.state).toEqual(state);
  });

  test('native history.pushState with non-object state does not synchronize runtime helpers', () => {
    expect(routeCurrentPath()).toBe('/a');

    history.pushState('raw-state', '', '/b');

    expect(routeCurrentPath()).toBe('/a');
    expect(routeBackPath()).toBeNull();
    expect(history.state).toBe('raw-state');
  });

  test('native history.replaceState does not synchronize runtime helpers', () => {
    routePush('/b');

    const state = { foo: 1 };
    history.replaceState(state, '', '/c?y=2');

    expect(routeCurrentPath()).toBe('/b');
    expect(routeBackPath()).toBe('/a');
    expect(history.state).toEqual(state);
  });

  test('native history.replaceState with non-object state does not synchronize runtime helpers', () => {
    expect(routeCurrentPath()).toBe('/a');

    history.replaceState(7, '', '/a?x=1');

    expect(routeCurrentPath()).toBe('/a');
    expect(routeBackPath()).toBeNull();
    expect(history.state).toBe(7);
  });

  test('popstate into a foreign non-object entry clears managed back path', () => {
    history.pushState('raw-state', '', '/b');
    replaceHistoryStateWithoutRuntimeSync('raw-state', '/b');
    window.dispatchEvent(new window.PopStateEvent('popstate', { state: history.state }));

    expect(routeCurrentPath()).toBe('/b');
    expect(routeBackPath()).toBeNull();
    expect(history.state).toBe('raw-state');
  });

  test('popstate into managed state from another owner clears managed back path', () => {
    cleanupDom();
    cleanupDom = installDom('/b');
    __resetRouteSystemForTest();

    replaceHistoryStateWithoutRuntimeSync(
      {
        foo: 1,
        __route: createManagedRouteState(
          {
            index: 1,
            stack: ['/a', '/b']
          },
          'foreign-owner'
        )
      },
      '/b'
    );
    window.dispatchEvent(new window.PopStateEvent('popstate', { state: history.state }));

    expect(routeCurrentPath()).toBe('/b');
    expect(routeBackPath()).toBeNull();
    expect((history.state as { foo?: number }).foo).toBe(1);
  });

  test('uses the last registered wildcard route as the fallback', () => {
    initRouteSystem();

    const firstFallback = Symbol('*-first');
    const secondFallback = Symbol('*-second');

    const unregisterFirstFallback = registerRoute({
      id: firstFallback,
      path: '*',
      component: (() => null) as never,
      decoders: {}
    });
    const unregisterSecondFallback = registerRoute({
      id: secondFallback,
      path: '*',
      component: (() => null) as never,
      decoders: {}
    });

    expect(getMatchedRouteId()).toBe(secondFallback);

    unregisterSecondFallback();
    expect(getMatchedRouteId()).toBe(firstFallback);

    unregisterFirstFallback();
    expect(getMatchedRouteId()).toBeNull();
  });

  test('keeps the fallback identity stable across exact route registration changes', () => {
    initRouteSystem();

    const fallback = Symbol('*');
    const exact = Symbol('/a');

    const unregisterFallback = registerRoute({
      id: fallback,
      path: '*',
      component: (() => null) as never,
      decoders: {}
    });

    expect(getMatchedRouteId()).toBe(fallback);

    const unregisterExact = registerRoute({
      id: exact,
      path: '/a',
      component: (() => null) as never,
      decoders: {}
    });

    expect(getMatchedRouteId()).toBe(exact);

    unregisterExact();
    expect(getMatchedRouteId()).toBe(fallback);

    unregisterFallback();
  });

  test('notifies subscribers only when route registration changes the active match', () => {
    initRouteSystem();

    let notifications = 0;
    const unsubscribe = subscribeRuntime(() => {
      notifications += 1;
    });

    const unregisterUnmatched = registerRoute({
      id: Symbol('/b'),
      path: '/b',
      component: (() => null) as never,
      decoders: {}
    });
    expect(notifications).toBe(0);

    const unregisterFallback = registerRoute({
      id: Symbol('*'),
      path: '*',
      component: (() => null) as never,
      decoders: {}
    });
    expect(notifications).toBe(1);

    const unregisterSecondFallback = registerRoute({
      id: Symbol('*-second'),
      path: '*',
      component: (() => null) as never,
      decoders: {}
    });
    expect(notifications).toBe(2);

    const unregisterExact = registerRoute({
      id: Symbol('/a'),
      path: '/a',
      component: (() => null) as never,
      decoders: {}
    });
    expect(notifications).toBe(3);

    unregisterUnmatched();
    expect(notifications).toBe(3);

    unregisterExact();
    expect(notifications).toBe(4);

    unregisterSecondFallback();
    expect(notifications).toBe(5);

    unregisterFallback();
    expect(notifications).toBe(6);

    unsubscribe();
  });

  test('reuses the matched route lookup until runtime state changes', () => {
    initRouteSystem();

    let reads = 0;
    const firstId = Symbol('/a');
    const secondId = Symbol('/b');

    const unregisterFirst = registerRoute({
      id: firstId,
      get path() {
        reads += 1;
        return '/a';
      },
      component: (() => null) as never,
      decoders: {}
    });

    const unregisterSecond = registerRoute({
      id: secondId,
      get path() {
        reads += 1;
        return '/b';
      },
      component: (() => null) as never,
      decoders: {}
    });

    expect(getMatchedRouteId()).toBe(firstId);
    const firstReadCount = reads;

    expect(getMatchedRouteId()).toBe(firstId);
    expect(reads).toBe(firstReadCount);

    unregisterSecond();
    unregisterFirst();
  });
});
