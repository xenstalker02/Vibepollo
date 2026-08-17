import { vi } from 'vitest';

// Minimal i18n mock for components expecting $t
Object.defineProperty(globalThis, '$t', { value: (key: string) => key, writable: true });

// JSDOM fetch mock (override in individual tests as needed)
vi.stubGlobal(
  'fetch',
  vi.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => ({}),
    text: async () => '',
  })),
);

// Silence Vue warnings in tests
vi.spyOn(console, 'warn').mockImplementation((message: unknown) => {
  if (typeof message === 'string' && message.includes('received an unexpected slot')) return;
});
