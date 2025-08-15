import { defineConfig } from "vite";
import type { Plugin } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteTsConfigPaths from "vite-tsconfig-paths";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Apply browser-only aliases via a plugin so SSR (including dev SSR) keeps real Node modules
function browserNodeAliasPlugin(): Plugin {
  const shims: Record<string, string> = {
    "node:stream/web": resolve(__dirname, "src/shims/node-stream-web.ts"),
    "node:stream": resolve(__dirname, "src/shims/node-stream.ts"),
    "node:async_hooks": resolve(__dirname, "src/shims/node-async-hooks.ts"),
  };
  return {
    name: "browser-node-alias",
    enforce: "pre",
  resolveId(id, _importer, options) {
      // Only alias on the client. When Vite resolves for SSR (dev or build), keep real Node modules.
      if (options?.ssr) return null;
      const target = shims[id];
      if (target) return target;
      return null;
    },
  };
}

export default defineConfig(() => {

  return {
    plugins: [
      browserNodeAliasPlugin(),
      viteTsConfigPaths({ projects: ["./tsconfig.json"] }),
      tailwindcss(),
      tanstackStart(),
    ],
    // Static aliases not required; handled by plugin above
    resolve: { alias: [] },
  };
});

/*
(GPT5 note on build error, need to look into this after alpha.)

## What broke and why
- TanStack Router’s SSR helpers import Node-only modules (`node:stream`, `node:stream/web`, `node:async_hooks`).
- Vite “externalizes” Node built-ins in the browser build, so `node:stream` became a browser-external stub with no exports. That’s why you saw: “Readable is not exported by __vite-browser-external…”.

## Changes made

1) Added minimal browser shims
- node-async-hooks.ts
  - Exports a no-op `AsyncLocalStorage` with `run()` calling the callback and `getStore()` returning `undefined`.
- node-stream-web.ts
  - Re-exports browser-native streams: `ReadableStream`, `WritableStream`, `TransformStream` from `globalThis`.
- node-stream.ts
  - Stubs for SSR imports: exports `Readable` and `PassThrough` classes with empty constructors.
  - These are only to satisfy imports; they’re not meant to be used at runtime in the browser.

2) Wired shims via conditional Vite aliases (browser-only)
- File: vite.config.ts
- Added `resolve.alias` entries only when `env.isSsrBuild !== true`:
  - `node:stream/web` → node-stream-web.ts
  - `node:stream` → node-stream.ts
  - `node:async_hooks` → node-async-hooks.ts
- SSR builds remain untouched; only the client build gets these aliases.

## Why this fixes the build
- The client bundle no longer receives Vite’s empty “browser external” for Node modules. Instead, imports resolve to our shims that export the expected symbols (`Readable`, streams, `AsyncLocalStorage`).
- Because aliases are browser-only, real Node modules still resolve correctly during SSR.

## How to handle it next time (playbook)
- See a Vite error about a Node module being externalized in the browser? Note the module name(s).
- Create a tiny shim in shims that exports exactly what the importing package expects (names must match).
- Add a client-only alias in vite.config.ts (guard with `!env.isSsrBuild`):
  - Map `node:<module>` → your shim path.
- Rebuild. If more missing names pop up, add minimal stubs to the shim (don’t over-polyfill).

## Caveats
- These shims are no-ops. Make sure SSR-only code paths don’t actually execute in the browser (guard with `typeof window === 'undefined'`, `import.meta.env.SSR`, or framework-specific guards).
- If a library starts using more Node APIs, extend the shim minimally or gate the usage.

## Verify
- Build at the repo root: turbo runs the web build.
- Optional: add a CI step that runs `turbo run build` to catch regressions early.

If you want, I can pin the @tanstack package versions and add a quick CI check to prevent this from resurfacing.
*/