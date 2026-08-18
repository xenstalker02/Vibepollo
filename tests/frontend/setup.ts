import { vi } from 'vitest';

// Minimal i18n mock for components expecting $t
Object.defineProperty(globalThis, '$t', { value: (key: string) => key, writable: true });

class TestResizeObserver implements ResizeObserver {
  constructor(_callback: ResizeObserverCallback) {}

  observe(_target: Element, _options?: ResizeObserverOptions): void {}

  unobserve(_target: Element): void {}

  disconnect(): void {}
}

class TestIntersectionObserver implements IntersectionObserver {
  readonly root = null;
  readonly rootMargin = '0px';
  readonly thresholds = [];

  constructor(_callback: IntersectionObserverCallback, _options?: IntersectionObserverInit) {}

  observe(_target: Element): void {}

  unobserve(_target: Element): void {}

  disconnect(): void {}

  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
}

vi.stubGlobal('ResizeObserver', TestResizeObserver);
vi.stubGlobal('IntersectionObserver', TestIntersectionObserver);
