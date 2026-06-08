import { createRequire } from "node:module";
import { join } from "node:path";
import type { BuiltQueue } from "./types";

/**
 * Load a CJS peer package by specifier, resolving from the consumer's project.
 *
 * Bull Board ships CJS-only and exposes `BullMQAdapter` at the subpath
 * `@bull-board/api/bullMQAdapter`, which ESM `import()` cannot resolve (no
 * exports entry for it). `createRequire` uses CJS resolution, which handles the
 * subpath correctly — and works from both our ESM and CJS builds.
 */
function makeRequire(): NodeRequire {
  // Resolve relative to the running app so we pick up its installed peer deps.
  return createRequire(join(process.cwd(), "noop.js"));
}

/**
 * Aggregate every built queue into a single Bull Board Express router.
 *
 * The `@bull-board/*` packages are optional peer deps, loaded lazily so that
 * consumers who pass `board: false` never need them installed.
 */
export async function buildBullBoardRouter(built: BuiltQueue[], basePath: string): Promise<unknown> {
  let createBullBoard: any;
  let BullMQAdapter: any;
  let ExpressAdapter: any;

  try {
    const req = makeRequire();
    ({ createBullBoard } = req("@bull-board/api"));
    ({ BullMQAdapter } = req("@bull-board/api/bullMQAdapter"));
    ({ ExpressAdapter } = req("@bull-board/express"));
  } catch (cause) {
    throw new Error(
      "bullmq-autoqueue: Bull Board is enabled but its packages could not be loaded.\n" +
        "  Install them:  npm i @bull-board/api @bull-board/express\n" +
        "  Or disable the dashboard:  loadQueues({ ..., board: false })\n" +
        `  Underlying error: ${(cause as Error)?.message ?? cause}`,
      { cause },
    );
  }

  const serverAdapter = new ExpressAdapter();
  serverAdapter.setBasePath(basePath);

  createBullBoard({
    queues: built.map((b) => new BullMQAdapter(b.queue, { readOnlyMode: b.readOnlyBoard })),
    serverAdapter,
  });

  return serverAdapter.getRouter();
}
