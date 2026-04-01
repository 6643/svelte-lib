import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { JSDOM } from 'jsdom';
// @ts-expect-error test-only client entry under Bun-only setup
import { mount as svelteMount, unmount as svelteUnmount } from '../../node_modules/svelte/src/internal/client/render.js';
// @ts-expect-error test-only client entry under Bun-only setup
import { flush_sync as flushSync } from '../../node_modules/svelte/src/internal/client/runtime.js';
import { __resetRouteSystemForTest, routePush } from '../router.svelte.ts';
import type { SyncRouteComponent } from '../types.ts';
import { loadCompiledComponent } from './helpers/compile-svelte.ts';
import { lifecycle, resetLifecycle } from './fixtures/lifecycle.ts';

let cleanupDom = () => {};
let mounted: any = null;
let mountedInstances: any[] = [];

const mount = (component: any, options: any) => {
  const instance = svelteMount(component, options);
  mounted = instance;
  mountedInstances.push(instance);
  return instance;
};

const replaceHistoryStateWithoutRuntimeSync = (state: unknown, url: string) => {
  const replaceState = Object.getPrototypeOf(history).replaceState as History['replaceState'];
  replaceState.call(history, state, '', url);
};

const installDom = (path: string) => {
  const dom = new JSDOM('<!doctype html><html><body></body></html>', {
    url: `https://app.test${path}`
  });

  const previous = {
    window: globalThis.window,
    document: globalThis.document,
    history: globalThis.history,
    location: globalThis.location,
    navigator: globalThis.navigator,
    Element: globalThis.Element,
    HTMLElement: globalThis.HTMLElement,
    Node: globalThis.Node,
    Text: globalThis.Text,
    Comment: globalThis.Comment,
    EventTarget: globalThis.EventTarget
  };

  globalThis.window = dom.window as never;
  globalThis.document = dom.window.document as never;
  globalThis.history = dom.window.history as never;
  globalThis.location = dom.window.location as never;
  globalThis.navigator = dom.window.navigator as never;
  globalThis.Element = dom.window.Element as never;
  globalThis.HTMLElement = dom.window.HTMLElement as never;
  globalThis.Node = dom.window.Node as never;
  globalThis.Text = dom.window.Text as never;
  globalThis.Comment = dom.window.Comment as never;
  globalThis.EventTarget = dom.window.EventTarget as never;

  return () => {
    globalThis.window = previous.window;
    globalThis.document = previous.document;
    globalThis.history = previous.history;
    globalThis.location = previous.location;
    globalThis.navigator = previous.navigator;
    globalThis.Element = previous.Element;
    globalThis.HTMLElement = previous.HTMLElement;
    globalThis.Node = previous.Node;
    globalThis.Text = previous.Text;
    globalThis.Comment = previous.Comment;
    globalThis.EventTarget = previous.EventTarget;
    dom.window.close();
  };
};

beforeEach(() => {
  cleanupDom = installDom('/missing');
  __resetRouteSystemForTest();
  resetLifecycle();
  mounted = null;
  mountedInstances = [];
});

afterEach(() => {
  for (const instance of mountedInstances.reverse()) {
    void svelteUnmount(instance);
  }

  __resetRouteSystemForTest();
  cleanupDom();
});

describe('Route component', () => {
  test('renders wildcard route when no exact path matches', async () => {
    const Route = await loadCompiledComponent('./route/Route.svelte');
    const NotFound = await loadCompiledComponent('./route/tests/fixtures/NotFound.svelte');
    const target = document.createElement('div');
    document.body.append(target);

    mounted = mount(Route, {
      target,
      props: {
        path: '*',
        component: NotFound
      }
    });

    flushSync();

    expect(target.querySelector('[data-testid="not-found"]')?.textContent).toBe('not-found');
  });

  test('renders an exact route match and injects decoded query props', async () => {
    cleanupDom();
    cleanupDom = installDom('/user?id=7');
    __resetRouteSystemForTest();

    const Route = await loadCompiledComponent('./route/Route.svelte');
    const SyncA = await loadCompiledComponent('./route/tests/fixtures/SyncA.svelte');
    const target = document.createElement('div');
    document.body.append(target);

    mount(Route, { target, props: { path: '/', component: SyncA } });
    mounted = mount(Route, { target, props: { path: '/user', component: SyncA, $id: Number } });

    flushSync();

    expect(target.querySelector('[data-testid="sync-a"]')?.textContent).toBe('{"id":7}');
  });

  test('later duplicate paths override earlier routes', async () => {
    cleanupDom();
    cleanupDom = installDom('/same');
    __resetRouteSystemForTest();

    const Route = await loadCompiledComponent('./route/Route.svelte');
    const SyncA = await loadCompiledComponent('./route/tests/fixtures/SyncA.svelte');
    const SyncB = await loadCompiledComponent('./route/tests/fixtures/SyncB.svelte');
    const target = document.createElement('div');
    document.body.append(target);

    mount(Route, { target, props: { path: '/same', component: SyncA } });
    mounted = mount(Route, { target, props: { path: '/same', component: SyncB } });

    flushSync();

    expect(target.querySelector('[data-testid="sync-b"]')?.textContent).toBe('{}');
    expect(target.querySelector('[data-testid="sync-a"]')).toBeNull();
  });

  test('later wildcard routes override earlier routes when no exact path matches', async () => {
    cleanupDom();
    cleanupDom = installDom('/missing');
    __resetRouteSystemForTest();

    const Route = await loadCompiledComponent('./route/Route.svelte');
    const SyncA = await loadCompiledComponent('./route/tests/fixtures/SyncA.svelte');
    const SyncB = await loadCompiledComponent('./route/tests/fixtures/SyncB.svelte');
    const target = document.createElement('div');
    document.body.append(target);

    mount(Route, {
      target,
      props: {
        path: '*',
        component: SyncA
      }
    });
    mounted = mount(Route, {
      target,
      props: {
        path: '*',
        component: SyncB
      }
    });

    flushSync();

    expect(target.querySelector('[data-testid="sync-b"]')?.textContent).toBe('{}');
    expect(target.querySelector('[data-testid="sync-a"]')).toBeNull();
  });

  test('query only navigation updates props without remounting', async () => {
    cleanupDom();
    cleanupDom = installDom('/user?id=1');
    __resetRouteSystemForTest();

    const Route = await loadCompiledComponent('./route/Route.svelte');
    const SyncA = await loadCompiledComponent('./route/tests/fixtures/SyncA.svelte');
    const target = document.createElement('div');
    document.body.append(target);

    mounted = mount(Route, {
      target,
      props: {
        path: '/user',
        component: SyncA,
        $id: Number
      }
    });

    flushSync();
    expect(lifecycle.syncAMounts).toBe(1);

    routePush('?id=2');
    flushSync();

    expect(lifecycle.syncAMounts).toBe(1);
    expect(target.querySelector('[data-testid="sync-a"]')?.textContent).toBe('{"id":2}');
  });

  test('path changes remount the component', async () => {
    cleanupDom();
    cleanupDom = installDom('/a');
    __resetRouteSystemForTest();

    const Route = await loadCompiledComponent('./route/Route.svelte');
    const SyncA = await loadCompiledComponent('./route/tests/fixtures/SyncA.svelte');
    const SyncB = await loadCompiledComponent('./route/tests/fixtures/SyncB.svelte');
    const target = document.createElement('div');
    document.body.append(target);

    mount(Route, { target, props: { path: '/a', component: SyncA } });
    mounted = mount(Route, { target, props: { path: '/b', component: SyncB } });

    flushSync();
    expect(lifecycle.syncAMounts).toBe(1);

    routePush('/b');
    flushSync();

    expect(lifecycle.syncADestroys).toBe(1);
    expect(target.querySelector('[data-testid="sync-b"]')?.textContent).toBe('{}');
  });

  test('native history.pushState rerenders the matched route', async () => {
    cleanupDom();
    cleanupDom = installDom('/a');
    __resetRouteSystemForTest();

    const Route = await loadCompiledComponent('./route/Route.svelte');
    const SyncA = await loadCompiledComponent('./route/tests/fixtures/SyncA.svelte');
    const SyncB = await loadCompiledComponent('./route/tests/fixtures/SyncB.svelte');
    const target = document.createElement('div');
    document.body.append(target);

    mount(Route, { target, props: { path: '/a', component: SyncA } });
    mounted = mount(Route, { target, props: { path: '/b', component: SyncB } });

    flushSync();
    expect(target.querySelector('[data-testid="sync-a"]')?.textContent).toBe('{}');

    history.pushState({ foo: 1 }, '', '/b');
    flushSync();

    expect(target.querySelector('[data-testid="sync-b"]')?.textContent).toBe('{}');
    expect(target.querySelector('[data-testid="sync-a"]')).toBeNull();
  });

  test('popstate changes rerender the matched route', async () => {
    cleanupDom();
    cleanupDom = installDom('/a');
    __resetRouteSystemForTest();

    const Route = await loadCompiledComponent('./route/Route.svelte');
    const SyncA = await loadCompiledComponent('./route/tests/fixtures/SyncA.svelte');
    const SyncB = await loadCompiledComponent('./route/tests/fixtures/SyncB.svelte');
    const target = document.createElement('div');
    document.body.append(target);

    mount(Route, { target, props: { path: '/a', component: SyncA } });
    mounted = mount(Route, { target, props: { path: '/b', component: SyncB } });

    flushSync();
    expect(target.querySelector('[data-testid="sync-a"]')?.textContent).toBe('{}');

    replaceHistoryStateWithoutRuntimeSync(
      {
        __route: {
          index: 1,
          stack: ['/a', '/b']
        }
      },
      '/b'
    );
    window.dispatchEvent(new window.PopStateEvent('popstate', { state: history.state }));
    flushSync();

    expect(target.querySelector('[data-testid="sync-b"]')?.textContent).toBe('{}');
    expect(target.querySelector('[data-testid="sync-a"]')).toBeNull();
  });

  test('throws for invalid extra props', async () => {
    const Route = await loadCompiledComponent('./route/Route.svelte');
    const SyncA = await loadCompiledComponent('./route/tests/fixtures/SyncA.svelte');
    const target = document.createElement('div');
    document.body.append(target);

    expect(() =>
      mount(Route, {
        target,
        props: {
          path: '/',
          component: SyncA,
          invalid: 'nope'
        }
      })
    ).toThrow(/Unsupported Route prop/);
  });

  test('throws for bare relative route paths', async () => {
    const Route = await loadCompiledComponent('./route/Route.svelte');
    const SyncA = await loadCompiledComponent('./route/tests/fixtures/SyncA.svelte');
    const target = document.createElement('div');
    document.body.append(target);

    expect(() =>
      mount(Route, {
        target,
        props: {
          path: 'user',
          component: SyncA
        }
      })
    ).toThrow(/absolute pathname/i);
  });

  test('throws for route paths that include query strings', async () => {
    const Route = await loadCompiledComponent('./route/Route.svelte');
    const SyncA = await loadCompiledComponent('./route/tests/fixtures/SyncA.svelte');
    const target = document.createElement('div');
    document.body.append(target);

    expect(() =>
      mount(Route, {
        target,
        props: {
          path: '/user?id=1',
          component: SyncA
        }
      })
    ).toThrow(/absolute pathname/i);
  });

  test('throws for route paths that include dot segments', async () => {
    const Route = await loadCompiledComponent('./route/Route.svelte');
    const SyncA = await loadCompiledComponent('./route/tests/fixtures/SyncA.svelte');
    const target = document.createElement('div');
    document.body.append(target);

    expect(() =>
      mount(Route, {
        target,
        props: {
          path: '/a/../b',
          component: SyncA
        }
      })
    ).toThrow(/absolute pathname/i);
  });

  test('passes $path and $component to the child as path and component props', async () => {
    cleanupDom();
    cleanupDom = installDom('/debug?path=one&component=two');
    __resetRouteSystemForTest();

    const Route = await loadCompiledComponent('./route/Route.svelte');
    const SyncA = await loadCompiledComponent('./route/tests/fixtures/SyncA.svelte');
    const target = document.createElement('div');
    document.body.append(target);

    mounted = mount(Route, {
      target,
      props: {
        path: '/debug',
        component: SyncA,
        $path: String,
        $component: String
      }
    });

    flushSync();

    expect(target.querySelector('[data-testid="sync-a"]')?.textContent).toBe('{"path":"one","component":"two"}');
  });

  test('throws when component changes after mount', async () => {
    cleanupDom();
    cleanupDom = installDom('/');
    __resetRouteSystemForTest();

    const MutableRouteHarness = await loadCompiledComponent('./route/tests/fixtures/MutableRouteHarness.svelte');
    const target = document.createElement('div');
    document.body.append(target);

    mounted = mount(MutableRouteHarness, { target });
    flushSync();

    expect(() => {
      flushSync(() => {
        mounted?.swap();
      });
    }).toThrow(/component/i);
  });

  test('throws when path changes after mount', async () => {
    cleanupDom();
    cleanupDom = installDom('/a');
    __resetRouteSystemForTest();

    const MutableRoutePathHarness = await loadCompiledComponent('./route/tests/fixtures/MutableRoutePathHarness.svelte');
    const target = document.createElement('div');
    document.body.append(target);

    mounted = mount(MutableRoutePathHarness, { target });
    flushSync();

    expect(() => {
      flushSync(() => {
        mounted?.swap();
      });
    }).toThrow(/path/i);
  });

  test('throws when decoder changes after mount', async () => {
    cleanupDom();
    cleanupDom = installDom('/decoder?id=1');
    __resetRouteSystemForTest();

    const MutableRouteDecoderHarness = await loadCompiledComponent('./route/tests/fixtures/MutableRouteDecoderHarness.svelte');
    const target = document.createElement('div');
    document.body.append(target);

    mounted = mount(MutableRouteDecoderHarness, { target });
    flushSync();

    expect(() => {
      flushSync(() => {
        mounted?.swap();
      });
    }).toThrow(/decoder/i);
  });

  test('bare zero-argument route loaders are treated as lazy loaders and are not probed eagerly', async () => {
    cleanupDom();
    cleanupDom = installDom('/ambiguous');
    __resetRouteSystemForTest();

    const Route = await loadCompiledComponent('./route/Route.svelte');
    const target = document.createElement('div');
    document.body.append(target);

    let loaderCalls = 0;
    const Ambiguous = () => {
      loaderCalls += 1;
      return Promise.resolve({ default: (() => null) as never });
    };

    mounted = mount(Route, {
      target,
      props: {
        path: '/ambiguous',
        component: Ambiguous
      }
    });

    expect(loaderCalls).toBe(0);
    flushSync();
    expect(loaderCalls).toBe(1);
  });

  test('renders lazy routes without default loading dom', async () => {
    cleanupDom();
    cleanupDom = installDom('/lazy?id=9');
    __resetRouteSystemForTest();

    const Route = await loadCompiledComponent('./route/Route.svelte');
    const LazyTarget = await loadCompiledComponent('./route/tests/fixtures/LazyTarget.svelte');
    const target = document.createElement('div');
    document.body.append(target);

    let resolveLoader: ((value: { default: SyncRouteComponent }) => void) | undefined;
    const Lazy = () =>
      new Promise<{ default: SyncRouteComponent }>((resolve) => {
        resolveLoader = resolve;
      });

    mounted = mount(Route, {
      target,
      props: {
        path: '/lazy',
        component: Lazy,
        $id: Number
      }
    });

    flushSync();
    expect(target.querySelector('[data-testid="lazy-target"]')).toBeNull();
    expect(target.textContent).toBe('');

    resolveLoader?.({ default: LazyTarget as SyncRouteComponent });
    await Promise.resolve();
    await Promise.resolve();
    flushSync();

    expect(target.querySelector('[data-testid="lazy-target"]')?.textContent).toBe('{"id":9}');
  });


  test('query only navigation keeps lazy routes mounted', async () => {
    cleanupDom();
    cleanupDom = installDom('/lazy?id=1');
    __resetRouteSystemForTest();
    resetLifecycle();

    const Route = await loadCompiledComponent('./route/Route.svelte');
    const SyncA = await loadCompiledComponent('./route/tests/fixtures/SyncA.svelte');
    const target = document.createElement('div');
    document.body.append(target);

    const Lazy = () => Promise.resolve({ default: SyncA as SyncRouteComponent });

    mounted = mount(Route, {
      target,
      props: {
        path: '/lazy',
        component: Lazy,
        $id: Number
      }
    });

    flushSync();
    await Promise.resolve();
    await Promise.resolve();
    flushSync();
    expect(lifecycle.syncAMounts).toBe(1);
    expect(lifecycle.syncADestroys).toBe(0);

    routePush('?id=2');
    flushSync();
    await Promise.resolve();
    await Promise.resolve();
    flushSync();

    expect(lifecycle.syncAMounts).toBe(1);
    expect(lifecycle.syncADestroys).toBe(0);
    expect(target.querySelector('[data-testid="sync-a"]')?.textContent).toBe('{"id":2}');
  });

  test('query only navigation does not restart a pending lazy load', async () => {
    cleanupDom();
    cleanupDom = installDom('/lazy?id=1');
    __resetRouteSystemForTest();

    const Route = await loadCompiledComponent('./route/Route.svelte');
    const SyncA = await loadCompiledComponent('./route/tests/fixtures/SyncA.svelte');
    const target = document.createElement('div');
    document.body.append(target);

    let loaderCalls = 0;
    let resolveLoader: ((value: { default: SyncRouteComponent }) => void) | undefined;
    const Lazy = () => {
      loaderCalls += 1;
      return new Promise<{ default: SyncRouteComponent }>((resolve) => {
        resolveLoader = resolve;
      });
    };

    mounted = mount(Route, {
      target,
      props: {
        path: '/lazy',
        component: Lazy,
        $id: Number
      }
    });

    flushSync();
    expect(loaderCalls).toBe(1);

    routePush('?id=2');
    flushSync();
    expect(loaderCalls).toBe(1);

    resolveLoader?.({ default: SyncA as SyncRouteComponent });
    await Promise.resolve();
    await Promise.resolve();
    flushSync();

    expect(target.querySelector('[data-testid="sync-a"]')?.textContent).toBe('{"id":2}');
  });

  test('reactivating a pending lazy route does not restart the loader', async () => {
    cleanupDom();
    cleanupDom = installDom('/lazy');
    __resetRouteSystemForTest();

    const Route = await loadCompiledComponent('./route/Route.svelte');
    const SyncA = await loadCompiledComponent('./route/tests/fixtures/SyncA.svelte');
    const target = document.createElement('div');
    document.body.append(target);

    let loaderCalls = 0;
    let resolveLoader: ((value: { default: SyncRouteComponent }) => void) | undefined;
    const Lazy = () => {
      loaderCalls += 1;
      return new Promise<{ default: SyncRouteComponent }>((resolve) => {
        resolveLoader = resolve;
      });
    };

    mounted = mount(Route, {
      target,
      props: {
        path: '/lazy',
        component: Lazy
      }
    });

    flushSync();
    expect(loaderCalls).toBe(1);

    routePush('/other');
    flushSync();
    routePush('/lazy');
    flushSync();

    expect(loaderCalls).toBe(1);

    resolveLoader?.({ default: SyncA as SyncRouteComponent });
    await Promise.resolve();
    await Promise.resolve();
    flushSync();

    expect(target.querySelector('[data-testid="sync-a"]')?.textContent).toBe('{}');
  });

  test('lazy routes fail with a clear error when the loader does not return a promise', async () => {
    cleanupDom();
    cleanupDom = installDom('/lazy');
    __resetRouteSystemForTest();

    const Route = await loadCompiledComponent('./route/Route.svelte');
    const target = document.createElement('div');
    document.body.append(target);

    mounted = mount(Route, {
      target,
      props: {
        path: '/lazy',
        component: () => null as never
      }
    });

    let thrown: unknown = null;

    try {
      flushSync();
      await Promise.resolve();
      await Promise.resolve();
    } catch (error) {
      thrown = error;
    }

    expect(thrown instanceof Error).toBe(true);
    expect((thrown as Error).message.includes('return a promise')).toBe(true);
  });

  test('inactive lazy route failures do not throw into the current page', async () => {
    cleanupDom();
    cleanupDom = installDom('/lazy');
    __resetRouteSystemForTest();

    const Route = await loadCompiledComponent('./route/Route.svelte');
    const SyncA = await loadCompiledComponent('./route/tests/fixtures/SyncA.svelte');
    const target = document.createElement('div');
    document.body.append(target);

    let rejectLoader: ((error: Error) => void) | undefined;
    const Lazy = () =>
      new Promise<{ default: SyncRouteComponent }>((_, reject) => {
        rejectLoader = reject;
      });

    mount(Route, {
      target,
      props: {
        path: '/lazy',
        component: Lazy
      }
    });

    mounted = mount(Route, {
      target,
      props: {
        path: '/other',
        component: SyncA
      }
    });

    flushSync();
    routePush('/other');
    flushSync();

    expect(target.querySelector('[data-testid="sync-a"]')?.textContent).toBe('{}');

    let thrown: unknown = null;

    try {
      rejectLoader?.(new Error('late boom'));
      await Promise.resolve();
      await Promise.resolve();
      flushSync();
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeNull();
    expect(target.querySelector('[data-testid="sync-a"]')?.textContent).toBe('{}');
  });

  test('active lazy loader failures are not retried automatically during the same mount', async () => {
    cleanupDom();
    cleanupDom = installDom('/lazy');
    __resetRouteSystemForTest();

    const Route = await loadCompiledComponent('./route/Route.svelte');
    const target = document.createElement('div');
    document.body.append(target);

    let loaderCalls = 0;
    let resolveSecondLoad: ((value: { default: SyncRouteComponent }) => void) | undefined;
    const Lazy = () => {
      loaderCalls += 1;

      if (loaderCalls === 1) {
        return Promise.reject(new Error('boom'));
      }

      return new Promise<{ default: SyncRouteComponent }>((resolve) => {
        resolveSecondLoad = resolve;
      });
    };

    mounted = mount(Route, {
      target,
      props: {
        path: '/lazy',
        component: Lazy
      }
    });

    try {
      flushSync();
      await Promise.resolve();
      await Promise.resolve();
    } catch {}

    try {
      flushSync();
      await Promise.resolve();
      await Promise.resolve();
    } catch {}

    flushSync();
    expect(loaderCalls).toBe(1);
    resolveSecondLoad?.({ default: (() => null) as unknown as SyncRouteComponent });
  });

  test('failed lazy routes may retry after the route becomes inactive and active again', async () => {
    cleanupDom();
    cleanupDom = installDom('/lazy');
    __resetRouteSystemForTest();

    const Route = await loadCompiledComponent('./route/Route.svelte');
    const SyncA = await loadCompiledComponent('./route/tests/fixtures/SyncA.svelte');
    const target = document.createElement('div');
    document.body.append(target);

    let loaderCalls = 0;
    let resolveSecondLoad: ((value: { default: SyncRouteComponent }) => void) | undefined;
    const Lazy = () => {
      loaderCalls += 1;

      if (loaderCalls === 1) {
        return Promise.reject(new Error('boom'));
      }

      return new Promise<{ default: SyncRouteComponent }>((resolve) => {
        resolveSecondLoad = resolve;
      });
    };

    mount(Route, {
      target,
      props: {
        path: '/lazy',
        component: Lazy
      }
    });

    mounted = mount(Route, {
      target,
      props: {
        path: '/other',
        component: SyncA
      }
    });

    try {
      flushSync();
      await Promise.resolve();
      await Promise.resolve();
    } catch {}

    expect(loaderCalls).toBe(1);

    routePush('/other');
    flushSync();
    routePush('/lazy');
    flushSync();

    expect(loaderCalls).toBe(2);

    resolveSecondLoad?.({ default: SyncA as SyncRouteComponent });
    await Promise.resolve();
    await Promise.resolve();
    flushSync();

    expect(target.querySelector('[data-testid="sync-a"]')?.textContent).toBe('{}');
  });
});
