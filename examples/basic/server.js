// Run: node examples/basic/server.js  (needs Redis on 127.0.0.1:6379 and the
// package built — `npm run build` — or swap the import to "../../src/index.ts"
// under a TS runtime).
import express from "express";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadQueues, installGracefulShutdown } from "bullmq-autoqueue";

const here = dirname(fileURLToPath(import.meta.url));

const registry = await loadQueues({
  dir: join(here, "queues"),
  connection: { host: "127.0.0.1", port: 6379 },
  defaults: {
    concurrency: 5,
    defaultJobOptions: { attempts: 3, backoff: { type: "exponential", delay: 1000 } },
  },
  board: { basePath: "/admin/queues" },
});

const app = express();

// One line mounts the dashboard for ALL queues.
app.use(registry.bullBoardBasePath, registry.bullBoardRouter);

app.post("/notify/:postId", async (req, res) => {
  const job = await registry.add("send-notification-followers", "notify", {
    postId: req.params.postId,
    followers: ["a", "b", "c"],
  });
  res.json({ jobId: job.id });
});

installGracefulShutdown(registry);

app.listen(8000, () => {
  console.log("up on :8000 — dashboard at http://localhost:8000/admin/queues");
  console.log("queues:", registry.names.join(", "));
});
