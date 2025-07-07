import { treaty } from "@elysiajs/eden";
import type { App } from "backend";

export const app = treaty<App>("localhost:4000");
