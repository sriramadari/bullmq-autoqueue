import { buildBullBoardRouter } from "./board";
import { buildQueue, resolveDefaults } from "./factory";
import { loadDefinitionsFromDir } from "./loader";
import { consoleLogger } from "./logger";
import { toKebabCase } from "./naming";
import { QueueRegistry } from "./registry";
import type { BuiltQueue, LoadQueuesOptions, QueueConfig, QueueDefinition } from "./types";

export { QueueRegistry } from "./registry";
export { installGracefulShutdown } from "./shutdown";
export { toKebabCase } from "./naming";
export type {
  BullBoardOptions,
  BuiltQueue,
  LoadQueuesOptions,
  Logger,
  QueueConfig,
  QueueDefaults,
  QueueDefinition,
} from "./types";
export type { ShutdownOptions } from "./shutdown";

/** Identity helper that gives you full type-checking + IntelliSense on a queue definition. */
export function defineQueue(def: QueueDefinition): QueueDefinition {
  return def;
}

/** Identity helper for a queue folder's `config.{js,ts}` file. */
export function defineConfig(config: QueueConfig): QueueConfig {
  return config;
}

function assertNoDuplicates(definitions: QueueDefinition[]): void {
  const seen = new Set<string>();
  for (const def of definitions) {
    if (seen.has(def.name)) {
      throw new Error(
        `bullmq-autoqueue: duplicate queue name "${def.name}". ` +
          `Names must be unique across the scanned folder and explicit \`queues\`.`,
      );
    }
    seen.add(def.name);
  }
}

/**
 * Discover and wire up every queue, then hand back a {@link QueueRegistry}.
 *
 * Convention: every folder under `dir` containing a `processor.{js,ts}` becomes
 * a queue; an optional sibling `config.{js,ts}` tunes it. Grouping folders (no
 * processor) are descended into. You can also pass explicit `queues`.
 *
 * @example
 * ```ts
 * const registry = await loadQueues({
 *   dir: "./queues",
 *   connection: { host: "127.0.0.1", port: 6379 },
 *   logger,
 *   defaults: { concurrency: 5, defaultJobOptions: { attempts: 3, backoff: { type: "exponential", delay: 1000 } } },
 *   board: { basePath: "/admin/queues" },
 * });
 *
 * app.use(registry.bullBoardBasePath!, registry.bullBoardRouter as RequestHandler);
 * await registry.add("send-notification-followers", "notify", { postId });
 * installGracefulShutdown(registry);
 * ```
 */
export async function loadQueues(options: LoadQueuesOptions): Promise<QueueRegistry> {
  const logger = options.logger ?? consoleLogger;
  const defaults = resolveDefaults(options.defaults);
  const naming = options.naming ?? toKebabCase;

  const definitions: QueueDefinition[] = [];
  if (options.dir) {
    definitions.push(...(await loadDefinitionsFromDir(options.dir, naming)));
  }
  if (options.queues?.length) {
    definitions.push(...options.queues);
  }

  if (definitions.length === 0) {
    logger.warn?.(
      "bullmq-autoqueue: no queues found. Pass `dir` to scan a folder or `queues` for explicit definitions.",
    );
  }
  assertNoDuplicates(definitions);

  const built: BuiltQueue[] = definitions.map((def) =>
    buildQueue(def, { connection: options.connection, logger, defaults }),
  );

  const registry = new QueueRegistry(built, logger);

  if (options.board !== false) {
    const basePath = options.board?.basePath ?? "/admin/queues";
    registry.bullBoardRouter = await buildBullBoardRouter(built, basePath);
    registry.bullBoardBasePath = basePath;
  }

  logger.info(
    `bullmq-autoqueue: loaded ${built.length} queue(s)` +
      (built.length ? `: ${built.map((b) => b.name).join(", ")}` : ""),
  );

  return registry;
}
