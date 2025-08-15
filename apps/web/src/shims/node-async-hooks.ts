// Minimal browser shim for `node:async_hooks`
export const AsyncLocalStorage = class<T = unknown> {
  // no-op polyfill for browser
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(_?: unknown) {}
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  run<R>(_store: T, callback: (...args: unknown[]) => R, ..._args: unknown[]): R {
    return callback();
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  getStore(): T | undefined { return undefined; }
};

export default { AsyncLocalStorage };
