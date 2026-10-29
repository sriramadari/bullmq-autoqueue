import { Queue, Worker } from "bullmq";
import type { ConnectionOptions } from "bullmq";
import { resolveQueueSettings } from "./settings";
import type { BuiltQueue, Logger, QueueDefinition, ResolvedDefaults } from "./types";

export { resolveDefaults } from "./settings";

interface BuildContext {
  connection: ConnectionOptions;
  logger: Logger;
  defaults: ResolvedDefaults;
}

/** Instantiate a Queue + Worker from a definition and wire lifecycle logging. */
export function buildQueue(def: QueueDefinition, ctx: BuildContext): BuiltQueue {
  const { connection, logger, defaults } = ctx;
  const settings = resolveQueueSettings(def, defaults);

  const queue = new Queue(def.name, {
    connection,
    defaultJobOptions: settings.defaultJobOptions,
    ...def.queueOptions,
  });

  const worker = new Worker(def.name, def.processor, {
    connection,
    concurrency: settings.concurrency,
    autorun: settings.autorun,
    ...def.workerOptions,
  });

  worker.on("completed", (job) => {
    logger.info(`[${def.name}] job ${job?.id} completed`);
  });
  worker.on("failed", (job, err) => {
    logger.error(`[${def.name}] job ${job?.id} failed: ${err?.message ?? err}`);
    if (err) logger.error(err);
  });
  worker.on("error", (err) => {
    logger.error(`[${def.name}] worker error: ${err?.message ?? err}`);
  });

  return {
    name: def.name,
    queue,
    worker,
    readOnlyBoard: settings.readOnlyBoard,
  };
}
