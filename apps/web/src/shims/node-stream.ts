// Minimal browser shim for `node:stream`
// Only export what's referenced by @tanstack/router SSR helpers
export class Readable {
  // Provide a minimal interface to satisfy imports; not intended for runtime use in the browser
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(_: any) {}
}

export class PassThrough {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(_: any) {}
}

export default { Readable, PassThrough };
