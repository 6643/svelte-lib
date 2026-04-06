import { describe, expect, test } from 'bun:test';
import { JSDOM } from 'jsdom';

import { buildPushState, buildReplaceState, normalizeHistoryState } from '../history.ts';
import { getRawAnchorNavigationTarget, normalizeNavigationTarget } from '../navigation.ts';
import { decodeQueryValue, decodeRouteProps } from '../query.ts';
import { resolveLazyRouteComponent } from '../route-validation.ts';

const PRIMARY_OWNER = 'owner-primary';
const FOREIGN_OWNER = 'owner-foreign';
const MAX_MANAGED_HISTORY_ENTRIES = 100;

const createAnchor = (href: string) => {
  const { window } = new JSDOM('<a></a>');
  const anchor = window.document.querySelector('a');

  if (!anchor) {
    throw new Error('failed to create anchor');
  }

  anchor.setAttribute('href', href);
  return anchor;
};

const expectManagedRouteState = (
  state: Record<string, unknown>,
  expected: {
    index: number;
    stack: string[];
  }
) => {
  const route = state.__route as {
    index: number;
    stack: string[];
    signature: unknown;
  };

  expect(route.index).toBe(expected.index);
  expect(route.stack).toEqual(expected.stack);
  expect(typeof route.signature).toBe('string');
};

describe('query decoders', () => {
  test('decodes Number values', () => {
    expect(decodeRouteProps('?id=12', { $id: Number })).toEqual({ id: 12 });
  });

  test('passes long and malformed strings to custom decoders unchanged', () => {
    const seen: Array<string | null> = [];
    const raw = `${'x'.repeat(1024)}%not-decoded`;

    decodeRouteProps(`?payload=${encodeURIComponent(raw)}`, {
      $payload(value: string | null) {
        seen.push(value);
        return value;
      }
    });

    expect(seen).toEqual([raw]);
  });

  test('custom decoders may choose to return undefined instead of throwing on invalid input', () => {
    expect(
      decodeRouteProps('?page=NaN', {
        $page(raw: string | null) {
          const parsed = Number(raw);
          return Number.isFinite(parsed) ? parsed : undefined;
        }
      })
    ).toEqual({ page: undefined });
  });

  test('decodes Boolean values', () => {
    expect(decodeRouteProps('?enabled=true', { $enabled: Boolean })).toEqual({ enabled: true });
  });

  test('decodes String values', () => {
    expect(decodeRouteProps('?name=ann', { $name: String })).toEqual({ name: 'ann' });
  });

  test('returns undefined for missing query keys', () => {
    expect(decodeRouteProps('', { $id: Number })).toEqual({ id: undefined });
  });

  test('returns undefined for invalid Number and Boolean values', () => {
    expect(decodeQueryValue('abc', Number)).toBeUndefined();
    expect(decodeQueryValue('1', Boolean)).toBeUndefined();
  });

  test('uses the first value for duplicate query keys', () => {
    expect(decodeRouteProps('?id=1&id=2', { $id: Number })).toEqual({ id: 1 });
  });

  test('custom decoder receives string or null', () => {
    const seen: Array<string | null> = [];

    decodeRouteProps('?filter=hot', {
      $filter(raw: string | null) {
        seen.push(raw);
        return raw?.toUpperCase();
      }
    });

    decodeRouteProps('', {
      $filter(raw: string | null) {
        seen.push(raw);
        return raw ?? undefined;
      }
    });

    expect(seen).toEqual(['hot', null]);
  });

  test('custom decoder exceptions bubble', () => {
    expect(() =>
      decodeRouteProps('?id=boom', {
        $id() {
          throw new Error('decoder boom');
        }
      })
    ).toThrow('decoder boom');
  });

  test('decoding dangerous keys does not mutate the props object prototype', () => {
    const props = decodeRouteProps('?__proto__=boom', {
      $__proto__(raw: string | null) {
        return { polluted: raw };
      }
    });

    expect(Object.getPrototypeOf(props)).toBeNull();
    expect(Object.prototype.hasOwnProperty.call(props, '__proto__')).toBe(true);
    expect((props as Record<string, unknown>).polluted).toBeUndefined();
  });
});

describe('route validation', () => {
  test('lazy route modules must expose a default component export', () => {
    expect(() => resolveLazyRouteComponent({})).toThrow(/lazy route component/i);
  });
});

describe('navigation', () => {
  test('ignores hash-only targets and keeps the current normalized path', () => {
    expect(normalizeNavigationTarget('#frag', '/user?id=1', 'https://app.test')).toBe('/user?id=1');
    expect(normalizeNavigationTarget('#', '/user?id=1', 'https://app.test')).toBe('/user?id=1');
  });

  test('keeps routeable anchor targets routable while dropping hashes during normalization', () => {
    const queryOnly = getRawAnchorNavigationTarget(createAnchor('?page=2#frag'));
    expect(queryOnly).toBe('?page=2#frag');
    expect(normalizeNavigationTarget(queryOnly!, '/user?id=1', 'https://app.test')).toBe('/user?page=2');

    const absolutePath = getRawAnchorNavigationTarget(createAnchor('/settings#advanced'));
    expect(absolutePath).toBe('/settings#advanced');
    expect(normalizeNavigationTarget(absolutePath!, '/user?id=1', 'https://app.test')).toBe('/settings');
  });

  test('normalizes query only targets against current pathname', () => {
    expect(normalizeNavigationTarget('?page=2', '/user?id=1', 'https://app.test')).toBe('/user?page=2');
  });

  test('treats bare question mark as clearing search', () => {
    expect(normalizeNavigationTarget('?', '/user?id=1', 'https://app.test')).toBe('/user');
  });

  test('normalizes same origin absolute urls', () => {
    expect(normalizeNavigationTarget('https://app.test/user?id=1#hash', '/', 'https://app.test')).toBe('/user?id=1');
  });

  test('rejects same origin absolute urls that resolve to a pathname starting with double slash', () => {
    expect(() => normalizeNavigationTarget('https://app.test//elsewhere.test/evil?x=1', '/', 'https://app.test')).toThrow(
      /pathname starting with \/\//
    );
  });

  test('drops hash from normalized targets', () => {
    expect(normalizeNavigationTarget('/user?id=1#hash', '/', 'https://app.test')).toBe('/user?id=1');
  });

  test('rejects protocol-relative cross-origin urls', () => {
    expect(() => normalizeNavigationTarget('//elsewhere.test/a', '/', 'https://app.test')).toThrow(/Cross-origin/);
  });

  test('treats bare relative paths as invalid', () => {
    expect(() => normalizeNavigationTarget('foo', '/', 'https://app.test')).toThrow(/Relative navigation/);
    expect(() => normalizeNavigationTarget('./foo', '/', 'https://app.test')).toThrow(/Relative navigation/);
    expect(() => normalizeNavigationTarget('../foo', '/', 'https://app.test')).toThrow(/Relative navigation/);
  });

  test('treats authored bare relative href as non-routable', () => {
    expect(getRawAnchorNavigationTarget(createAnchor('foo'))).toBeNull();
    expect(getRawAnchorNavigationTarget(createAnchor('./foo'))).toBeNull();
    expect(getRawAnchorNavigationTarget(createAnchor('../foo'))).toBeNull();
  });

  test('treats javascript href as non-routable', () => {
    expect(getRawAnchorNavigationTarget(createAnchor('javascript:alert(1)'))).toBeNull();
  });
});

describe('history state', () => {
  test('repairs non router managed history state and preserves foreign fields', () => {
    const state = normalizeHistoryState({ foo: 1 }, '/', PRIMARY_OWNER);

    expect(state.foo).toBe(1);
    expectManagedRouteState(state, {
      index: 0,
      stack: ['/']
    });
  });

  test('repairs malformed router managed history state and preserves foreign fields', () => {
    const state = normalizeHistoryState(
      {
        foo: 1,
        __route: {
          index: -1,
          stack: [42]
        }
      },
      '/a',
      PRIMARY_OWNER
    );

    expect(state.foo).toBe(1);
    expectManagedRouteState(state, {
      index: 0,
      stack: ['/a']
    });
  });

  test('repairs valid-shape router managed history state created by another owner', () => {
    const foreignState = buildPushState(normalizeHistoryState(undefined, '/a', FOREIGN_OWNER), '/b', FOREIGN_OWNER);
    const normalized = normalizeHistoryState(foreignState, '/b', PRIMARY_OWNER);

    expectManagedRouteState(normalized, {
      index: 0,
      stack: ['/b']
    });
  });

  test('trusted managed history survives normalization', () => {
    const ownedState = buildPushState(normalizeHistoryState({ foo: 1 }, '/a', PRIMARY_OWNER), '/b', PRIMARY_OWNER);
    const normalized = normalizeHistoryState(ownedState, '/b', PRIMARY_OWNER);

    expect(normalized).toEqual(ownedState);
  });

  test('builds push state by truncating forward history and refreshing the signature', () => {
    const state = buildPushState(
      {
        foo: 1,
        __route: {
          index: 0,
          stack: ['/a', '/b'],
          signature: 'stale-signature'
        }
      },
      '/c',
      PRIMARY_OWNER
    );

    expect(state.foo).toBe(1);
    expectManagedRouteState(state, {
      index: 1,
      stack: ['/a', '/c']
    });
  });

  test('builds replace state without growing history and refreshing the signature', () => {
    const state = buildReplaceState(
      {
        foo: 1,
        __route: {
          index: 1,
          stack: ['/a', '/b'],
          signature: 'stale-signature'
        }
      },
      '/c',
      PRIMARY_OWNER
    );

    expect(state.foo).toBe(1);
    expectManagedRouteState(state, {
      index: 1,
      stack: ['/a', '/c']
    });
  });

  test('caps managed history stack growth to the configured maximum', () => {
    let state = normalizeHistoryState(undefined, '/p0', PRIMARY_OWNER);

    for (let index = 1; index <= MAX_MANAGED_HISTORY_ENTRIES + 10; index += 1) {
      state = buildPushState(state, `/p${index}`, PRIMARY_OWNER);
    }

    expectManagedRouteState(state, {
      index: MAX_MANAGED_HISTORY_ENTRIES - 1,
      stack: Array.from({ length: MAX_MANAGED_HISTORY_ENTRIES }, (_, index) => `/p${index + 11}`)
    });
  });
});

describe('public api', () => {
  test('exports the route api from the public entry', async () => {
    const entry = await import('../_.ts');

    expect(typeof entry.Route).toBe('string');
    expect('lazyRoute' in entry).toBe(false);
    expect(typeof entry.routePush).toBe('function');
    expect(typeof entry.routeReplace).toBe('function');
    expect(typeof entry.routeCurrentPath).toBe('function');
    expect(typeof entry.routeBackPath).toBe('function');
    expect(typeof entry.routeForwardPath).toBe('function');
    expect('__resetRouteSystemForTest' in entry).toBe(false);
  });
});
