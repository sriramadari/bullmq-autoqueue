import type { BuiltQueue } from "./types";

/**
 * Aggregate every built queue into a single Bull Board Express router.
 *
 * The `@bull-board/*` packages are optional peer deps, lazily imported so that
 * consumers who pass `board: false` never need them installed.
 */
export async function buildBullBoardRouter(built: BuiltQueue[], basePath: string): Promise<unknown> {
  let createBullBoard: any;
  let BullMQAdapter: any;
  let ExpressAdapter: any;

  try {
    ({ createBullBoard } = await import("@bull-board/api"));
    ({ BullMQAdapter } = await import("@bull-board/api/bullMQAdapter"));
    ({ ExpressAdapter } = await import("@bull-board/express"));
  } catch {
    throw new Error(
      "bullmq-autoqueue: Bull Board is enabled but its packages are not installed.\n" +
        "  Install them:  npm i @bull-board/api @bull-board/express\n" +
        "  Or disable the dashboard:  loadQueues({ ..., board: false })",
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
