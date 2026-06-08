import type {
  ConnectionOptions,
  JobsOptions,
  Processor,
  Queue,
  QueueOptions,
  Worker,
  WorkerOptions,
} from "bullmq";

/**
 * Minimal logger contract. Anything with `info` and `error` works — e.g. a
 * Winston/Pino instance, or the built-in console. `warn`/`debug` are optional.
 */
export interface Logger {
  info(message: string): void;
  error(message: string | Error): void;
  warn?(message: string): void;
  debug?(message: string): void;
}

/**
 * A fully-specified queue. In convention mode this is assembled for you from a
 * folder's `processor.{js,ts}` (the processor) + optional `config.{js,ts}`.
 */
export interface QueueDefinition<DataType = any, ResultType = any, NameType extends string = string> {
  /** Queue name (kebab-case recommended). Derived from the folder name in convention mode. */
  name: string;
  /** The job processor. Default export of `processor.{js,ts}` in convention mode. */
  processor: Processor<DataType, ResultType, NameType>;
  /** Worker concurrency. Overrides `defaults.concurrency`. */
  concurrency?: number;
  /** Queue-level default job options (attempts, backoff, removeOnComplete, …). Merged over `defaults.defaultJobOptions`. */
  defaultJobOptions?: JobsOptions;
  /** Extra Queue options, merged (minus `connection`, which is injected). */
  queueOptions?: Omit<QueueOptions, "connection">;
  /** Extra Worker options, merged (minus `connection`/`concurrency`, which are managed). */
  workerOptions?: Omit<WorkerOptions, "connection" | "concurrency">;
  /** Whether the worker auto-starts. Default `true`. */
  autorun?: boolean;
  /** Expose this queue read-only in Bull Board. Defaults to `defaults.readOnlyBoard` (true). */
  readOnlyBoard?: boolean;
}

/**
 * The shape of a `config.{js,ts}` file in a queue folder: everything in a
 * {@link QueueDefinition} except the processor, all optional. `name` overrides
 * the folder-derived name.
 */
export type QueueConfig = Partial<Omit<QueueDefinition, "processor">>;

/** Defaults applied to every queue unless the queue overrides them. */
export interface QueueDefaults {
  concurrency?: number;
  defaultJobOptions?: JobsOptions;
  readOnlyBoard?: boolean;
  autorun?: boolean;
}

/** Internal: defaults after filling in fallback values. */
export interface ResolvedDefaults {
  concurrency: number;
  defaultJobOptions: JobsOptions;
  readOnlyBoard: boolean;
  autorun: boolean;
}

/** A queue after it has been instantiated (Queue + Worker wired up). */
export interface BuiltQueue {
  name: string;
  queue: Queue;
  worker: Worker;
  readOnlyBoard: boolean;
}

export interface BullBoardOptions {
  /** Mount path for the dashboard router, e.g. `"/admin/queues"`. */
  basePath?: string;
}

export interface LoadQueuesOptions {
  /** ioredis connection options shared by every queue and worker. */
  connection: ConnectionOptions;
  /**
   * Root folder to scan. Every directory containing a `processor.{js,ts}` is
   * treated as one queue; grouping folders (no processor) are descended into.
   */
  dir?: string;
  /** Explicit queue definitions, merged with anything discovered under `dir`. */
  queues?: QueueDefinition[];
  /** Logger for queue lifecycle + worker completed/failed events. Default: console. */
  logger?: Logger;
  /** Defaults applied to every queue. */
  defaults?: QueueDefaults;
  /**
   * Bull Board config, or `false` to skip building the dashboard (and avoid
   * needing the `@bull-board/*` peer deps). Default: mounted at `/admin/queues`.
   */
  board?: BullBoardOptions | false;
  /** Map a folder name to a queue name. Default: kebab-case. */
  naming?: (folderName: string) => string;
}
