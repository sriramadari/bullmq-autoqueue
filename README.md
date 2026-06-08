# bullmq-autoqueue

**Convention-based [BullMQ](https://docs.bullmq.io/) queue loader with an automatic [Bull Board](https://github.com/felixmosh/bull-board) dashboard.**

Drop a folder with a `processor.js`, and you get a fully-wired `Queue` + `Worker` + dashboard entry — no central registry to edit, no per-queue boilerplate to copy.

```ts
const registry = await loadQueues({ dir: "./queues", connection });
app.use(registry.bullBoardBasePath, registry.bullBoardRouter);
```

---

## Why

Every BullMQ queue is the same ~30 lines: `new Queue(...)`, `new Worker(...)`, `worker.on("completed" | "failed", …)`, then a `BullMQAdapter` for Bull Board. With a dozen queues you pay for it in **four** places — the queue file, the manual `require` list, the `createBullBoard({ queues: [...] })` array, and graceful shutdown. Add a queue, forget one of the four, and it silently doesn't process or doesn't appear in the dashboard.

`bullmq-autoqueue` replaces all of that with a folder convention. Each queue folder contains only its **actual logic**; everything else is wired for you.

### Before — one of N hand-written queue files

```js
// queues/sendNotificationFollowers/index.js
const { Queue, Worker } = require("bullmq");
const { BullMQAdapter } = require("@bull-board/api/bullMQAdapter");
const connection = require("../../config/bullconfig");
const logger = require("../../logger");
const processor = require("./processor");

const queue = new Queue("send-notification-followers", { connection });
const worker = new Worker("send-notification-followers", processor, { connection, concurrency: 5, autorun: true });
worker.on("completed", (job) => logger.info(`... ${job?.id} COMPLETED`));
worker.on("failed", (job) => logger.error(`... ${job?.id} FAILED`));

exports.sendNotificationFollowersAdapter = new BullMQAdapter(queue, { readOnlyMode: true });
exports.sendNotificationFollowers = queue;
```

…repeated for every queue, plus a hand-maintained import list and `createBullBoard([...])` array in your server entry.

### After

```js
// queues/sendNotificationFollowers/processor.js   ← the ONLY file you write
module.exports = async (job) => {
  const { postId, followers } = job.data;
  // ...business logic
};
```

```js
// queues/sendNotificationFollowers/config.js       ← optional, for overrides
module.exports = { concurrency: 5 };
```

```ts
// server.ts — wiring for ALL queues, once
import express from "express";
import { loadQueues, installGracefulShutdown } from "bullmq-autoqueue";
import logger from "./logger";

const registry = await loadQueues({
  dir: "./queues",
  connection: { host: "127.0.0.1", port: 6379 },
  logger,
  defaults: {
    concurrency: 5,
    defaultJobOptions: { attempts: 3, backoff: { type: "exponential", delay: 1000 } },
  },
  board: { basePath: "/admin/queues" },
});

const app = express();
app.use(registry.bullBoardBasePath!, registry.bullBoardRouter as express.RequestHandler);

await registry.add("send-notification-followers", "notify", { postId, followers });

installGracefulShutdown(registry); // closes workers + queues on SIGTERM/SIGINT
app.listen(8000);
```

Add a new queue later? Create one folder. That's the whole change.

---

## Install

```bash
npm i bullmq-autoqueue bullmq
# Only if you use the dashboard (default on):
npm i @bull-board/api @bull-board/express
```

`bullmq` is a peer dependency. `@bull-board/api` and `@bull-board/express` are **optional** peers — needed only when the dashboard is enabled. Pass `board: false` to skip them.

> **Node 18+**, ESM or CommonJS. Ships dual `import`/`require` builds and full type declarations.

---

## The convention

```
queues/
├── sendNotificationFollowers/
│   ├── processor.js        # required — default-exports async (job) => {...}
│   └── config.js           # optional — default-exports overrides
├── reelUpload/
│   └── processor.js
└── emailQueues/            # grouping folder (no processor) — descended into
    ├── otpEmail/
    │   ├── processor.js
    │   └── config.js
    └── generalEmail/
        └── processor.js
```

- A folder with a **`processor.*`** is a queue. Its name defaults to the folder name in kebab-case (`sendNotificationFollowers` → `send-notification-followers`); override with `config.name`.
- A folder **without** a processor is a grouping folder and is descended into (so nested layouts like `emailQueues/otpEmail` just work).
- A queue folder is **not** descended into — its subfolders are private helpers.

`processor.*` and `config.*` may be `.js`, `.mjs`, `.cjs`, or `.ts` (TypeScript requires a runtime loader such as `tsx`/`ts-node`, or precompile).

### `config.js` options

```ts
import { defineConfig } from "bullmq-autoqueue";

export default defineConfig({
  name: "otp-emails",                 // override the derived name
  concurrency: 20,
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: "fixed", delay: 1500 },
    removeOnComplete: 1000,
    removeOnFail: 2000,
  },
  autorun: true,
  readOnlyBoard: true,                // read-only in Bull Board
  queueOptions: {},                   // extra QueueOptions (minus connection)
  workerOptions: {},                  // extra WorkerOptions (minus connection/concurrency)
});
```

---

## API

### `loadQueues(options): Promise<QueueRegistry>`

| Option       | Type                                  | Default            | Notes |
|--------------|---------------------------------------|--------------------|-------|
| `connection` | `ConnectionOptions`                   | —                  | **Required.** Shared by every queue + worker. |
| `dir`        | `string`                              | —                  | Folder to scan with the convention. |
| `queues`     | `QueueDefinition[]`                   | —                  | Explicit definitions, merged with discovered ones. |
| `logger`     | `Logger`                              | `console`          | Receives lifecycle + completed/failed events. |
| `defaults`   | `QueueDefaults`                       | `{ concurrency: 1, readOnlyBoard: true, autorun: true }` | Applied to every queue unless overridden. |
| `board`      | `{ basePath?: string } \| false`      | `{ basePath: "/admin/queues" }` | `false` skips the dashboard (and its peer deps). |
| `naming`     | `(folder: string) => string`          | kebab-case         | Folder-name → queue-name mapper. |

### `QueueRegistry`

| Member                | Description |
|-----------------------|-------------|
| `add(name, jobName, data, opts?)` | Enqueue a job by queue name. Throws on unknown name. |
| `queue(name)`         | The underlying BullMQ `Queue`. |
| `worker(name)`        | The underlying BullMQ `Worker`. |
| `names` / `size`      | Loaded queue names / count. |
| `bullBoardRouter`     | Express router for the dashboard (when enabled). |
| `bullBoardBasePath`   | Where to mount it. |
| `closeAll()`          | Gracefully close all workers then queues. |

### `installGracefulShutdown(registry, options?)`

Wires `SIGTERM`/`SIGINT` to `registry.closeAll()` before exit. Idempotent.

### Helpers

- `defineQueue(def)` / `defineConfig(config)` — identity functions for full type-checking.
- `toKebabCase(str)` — the default naming function, exported for reuse.

---

## Explicit (no-folder) usage

You don't have to use the filesystem convention:

```ts
import { loadQueues, defineQueue } from "bullmq-autoqueue";

const registry = await loadQueues({
  connection,
  board: false,
  queues: [
    defineQueue({ name: "emails", processor: async (job) => {/* ... */}, concurrency: 10 }),
    defineQueue({ name: "thumbnails", processor: async (job) => {/* ... */} }),
  ],
});
```

`dir` and `queues` can be combined.

---

## License

MIT
