/**
 * `bullmq-autoqueue/core` — the convention logic with no Node built-ins and no
 * runtime `bullmq` import. Safe to bundle for browsers, edge runtimes and
 * build tools: discover queue folders from any directory lister, derive names,
 * merge settings over defaults, and render scaffold code.
 */
import type { QueueConfig, QueueDefinition } from "./types";

export { toKebabCase } from "./naming";
export { renderConfig, renderProcessor } from "./templates";
export type { CodeStyle } from "./templates";
export { SCRIPT_EXTS, assertUniqueNames, discoverQueueFolders, toQueueDefinition } from "./discover";
export type { DirEntry, DiscoveredQueue, ListDir } from "./discover";
export { resolveDefaults, resolveQueueSettings } from "./settings";
export type { QueueSettings } from "./settings";
export { QueueRegistry } from "./registry";
export type {
  BuiltQueue,
  Logger,
  QueueConfig,
  QueueDefaults,
  QueueDefinition,
  ResolvedDefaults,
} from "./types";

/** Identity helper that gives you full type-checking + IntelliSense on a queue definition. */
export function defineQueue(def: QueueDefinition): QueueDefinition {
  return def;
}

/** Identity helper for a queue folder's `config.{js,ts}` file. */
export function defineConfig(config: QueueConfig): QueueConfig {
  return config;
}
