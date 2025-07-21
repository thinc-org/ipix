import { treaty } from "@elysiajs/eden";
import type { App } from "@repo/api";

const API_BASE_URL = process.env.API_BASE_URL;

if (!API_BASE_URL) {
  throw new Error('API_BASE_URL is required but not defined')
}

const app = treaty<App>(API_BASE_URL);

export default app