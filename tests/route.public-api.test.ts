import { expect, test } from 'bun:test';

import * as routeExports from '../route/_.ts';

test('route public api does not export lazyRoute', () => {
  expect('lazyRoute' in routeExports).toBe(false);
  expect(typeof routeExports.Route).toBe('string');
});
