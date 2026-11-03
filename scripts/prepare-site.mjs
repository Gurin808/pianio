import { cp, rm } from "node:fs/promises";
await rm(new URL("../dist", import.meta.url), { recursive: true, force: true });
await cp(new URL("../apps/web/dist", import.meta.url), new URL("../dist", import.meta.url), { recursive: true });
