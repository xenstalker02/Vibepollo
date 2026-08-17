import { expect, test } from 'vitest';
import { routes } from '@web/router';

test('exposes the public route paths', () => {
  expect(routes.map(({ path }) => path)).toEqual([
    '/',
    '/applications',
    '/settings',
    '/logs',
    '/troubleshooting',
    '/clients',
    '/webrtc',
  ]);
});
