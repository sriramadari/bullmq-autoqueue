import type { Job, JobsOptions, Queue, Worker } from "bullmq";
import type { BuiltQueue, Logger } from "./types";

/**
 * Handle to every loaded queue. Returned by {@link loadQueues}. Use it to
 * enqueue jobs, reach the underlying Queue/Worker, mount the dashboard, and
 * shut everything down cleanly.
 */
export class QueueRegistry {
  /** The Bull Board Express router, present when the dashboard is enabled. Mount it yourself. */
  public bullBoardRouter: unknown = null;
  /** Where the dashboard router expects to be mounted (mirrors `board.basePath`). */
  public bullBoardBasePath: string | null = null;

  private readonly byName = new Map<string, BuiltQueue>();

  constructor(
    built: BuiltQueue[],
    private readonly logger: Logger,
  ) {
    for (const b of built) this.byName.set(b.name, b);
  }

  /** All queue names, in load order. */
  get names(): string[] {
    return [...this.byName.keys()];
  }

  /** Number of loaded queues. */
  get size(): number {
    return this.byName.size;
  }

  /** Get the BullMQ `Queue` for a name (for `.add`, `.getJobCounts`, …). */
  queue(name: string): Queue | undefined {
    return this.byName.get(name)?.queue;
  }

  /** Get the BullMQ `Worker` for a name. */
  worker(name: string): Worker | undefined {
    return this.byName.get(name)?.worker;
  }

  /** Enqueue a job by queue name. Rejects if the queue is unknown. */
  async add<T = any>(queueName: string, jobName: string, data: T, opts?: JobsOptions): Promise<Job<T>> {
    const q = this.byName.get(queueName)?.queue;
    if (!q) {
      throw new Error(
        `bullmq-autoqueue: no queue named "${queueName}". Known queues: ${this.names.join(", ") || "(none)"}`,
      );
    }
    return q.add(jobName, data, opts) as Promise<Job<T>>;
  }

  /**
   * Gracefully close every worker then every queue. Safe to call once on
   * shutdown; see {@link installGracefulShutdown}.
   */
  async closeAll(): Promise<void> {
    const items = [...this.byName.values()];
    await Promise.allSettled(items.map((b) => b.worker.close()));
    await Promise.allSettled(items.map((b) => b.queue.close()));
    this.logger.info(`bullmq-autoqueue: closed ${items.length} queue(s)`);
  }
}
