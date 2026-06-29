import { expect, test } from 'bun:test';

import * as routeExports from '../_.ts';

test('route public api stays narrow', () => {
  expect('Route' in routeExports).toBe(true);
  expect('routePush' in routeExports).toBe(true);
  expect('routeReplace' in routeExports).toBe(true);
  expect('initRuntime' in routeExports).toBe(false);
  expect('registerRoute' in routeExports).toBe(false);
});
