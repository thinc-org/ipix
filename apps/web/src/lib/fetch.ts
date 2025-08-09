import { treaty } from "@elysiajs/eden";
import type { App } from "@repo/api";

// Prefer Vite env if available, then process.env (for SSR/tests), else default.
const VITE_URL = import.meta.env.VITE_API_BASE_URL as
  | string
  | undefined;
const NODE_URL = (process as any)?.env?.API_BASE_URL as string | undefined;

let API_BASE_URL = VITE_URL ?? NODE_URL ?? "http://localhost:20257";

// Ensure URL has protocol for fetch
if (!/^https?:\/\//i.test(API_BASE_URL)) {
  API_BASE_URL = `http://${API_BASE_URL}`;
}

const app = treaty<App>(API_BASE_URL, {
  fetch: {
    credentials: "include",
  },
});

export default app;