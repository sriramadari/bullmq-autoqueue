import { Queue, Worker } from "bullmq";
import type { ConnectionOptions } from "bullmq";
import type { BuiltQueue, Logger, QueueDefaults, QueueDefinition, ResolvedDefaults } from "./types";

const DEFAULTS: ResolvedDefaults = {
  concurrency: 1,
  defaultJobOptions: {},
  readOnlyBoard: true,
  autorun: true,
};

export function resolveDefaults(defaults: QueueDefaults | undefined): ResolvedDefaults {
  return {
    concurrency: defaults?.concurrency ?? DEFAULTS.concurrency,
    defaultJobOptions: defaults?.defaultJobOptions ?? DEFAULTS.defaultJobOptions,
    readOnlyBoard: defaults?.readOnlyBoard ?? DEFAULTS.readOnlyBoard,
    autorun: defaults?.autorun ?? DEFAULTS.autorun,
  };
}

interface BuildContext {
  connection: ConnectionOptions;
  logger: Logger;
  defaults: ResolvedDefaults;
}

/** Instantiate a Queue + Worker from a definition and wire lifecycle logging. */
export function buildQueue(def: QueueDefinition, ctx: BuildContext): BuiltQueue {
  const { connection, logger, defaults } = ctx;

  const queue = new Queue(def.name, {
    connection,
    defaultJobOptions: { ...defaults.defaultJobOptions, ...def.defaultJobOptions },
    ...def.queueOptions,
  });

  const worker = new Worker(def.name, def.processor, {
    connection,
    concurrency: def.concurrency ?? defaults.concurrency,
    autorun: def.autorun ?? defaults.autorun,
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
    readOnlyBoard: def.readOnlyBoard ?? defaults.readOnlyBoard,
  };
}
