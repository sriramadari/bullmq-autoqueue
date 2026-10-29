import type { QueueConfig, QueueDefinition } from "./types";

/** Runtime-resolvable script extensions, in resolution order. */
export const SCRIPT_EXTS = [".js", ".mjs", ".cjs", ".ts"];
const PROCESSOR_BASE = "processor";
const CONFIG_BASE = "config";
const IGNORED_DIRS = new Set(["node_modules", "dist", "build", "coverage"]);

/** One directory entry, as returned by a {@link ListDir}. */
export interface DirEntry {
  name: string;
  isDirectory: boolean;
}

/**
 * Lists the entries directly inside `dir`. The Node loader passes `fs.readdir`;
 * anything else (a virtual tree, a bundler manifest, a test fixture) works too.
 */
export type ListDir = (dir: string) => DirEntry[] | Promise<DirEntry[]>;

/** A folder that the convention turned into a queue. */
export interface DiscoveredQueue {
  /** Path of the queue folder. */
  dir: string;
  /** The folder's own name, which the queue name is derived from. */
  folderName: string;
  processorFile: string;
  configFile: string | null;
}

const defaultJoin = (a: string, b: string) => (a.endsWith("/") ? a + b : `${a}/${b}`);

function pick(files: Set<string>, base: string): string | null {
  for (const ext of SCRIPT_EXTS) {
    if (files.has(base + ext)) return base + ext;
  }
  return null;
}

/**
 * Walk `root`. A directory that directly contains a `processor.*` file is a
 * queue (we do not descend into it — its subfolders are private helpers). Any
 * other directory is a grouping folder and we descend into it. This handles
 * nested layouts like `queues/emailQueues/otpEmail/processor.js`.
 */
export async function discoverQueueFolders(
  root: string,
  listDir: ListDir,
  join: (a: string, b: string) => string = defaultJoin,
): Promise<DiscoveredQueue[]> {
  const found: DiscoveredQueue[] = [];

  async function walk(dir: string, folderName: string): Promise<void> {
    const entries = await listDir(dir);
    const files = new Set(entries.filter((e) => !e.isDirectory).map((e) => e.name));
    const processor = pick(files, PROCESSOR_BASE);
    if (processor) {
      const config = pick(files, CONFIG_BASE);
      found.push({
        dir,
        folderName,
        processorFile: join(dir, processor),
        configFile: config ? join(dir, config) : null,
      });
      return;
    }
    for (const entry of entries) {
      if (!entry.isDirectory) continue;
      if (entry.name.startsWith(".") || IGNORED_DIRS.has(entry.name)) continue;
      await walk(join(dir, entry.name), entry.name);
    }
  }

  await walk(root, root.split(/[\\/]/).filter(Boolean).pop() ?? "");
  return found;
}

/**
 * Assemble a {@link QueueDefinition} from a queue folder's loaded modules,
 * validating their shapes. `config.name` overrides the folder-derived name.
 */
export function toQueueDefinition(
  found: DiscoveredQueue,
  processor: unknown,
  config: unknown,
  naming: (folderName: string) => string,
): QueueDefinition {
  if (typeof processor !== "function") {
    throw new Error(
      `bullmq-autoqueue: ${found.processorFile} must default-export a processor function ` +
        `(got ${typeof processor}).`,
    );
  }
  let cfg: QueueConfig = {};
  if (found.configFile) {
    if (config && typeof config === "object") {
      cfg = config as QueueConfig;
    } else {
      throw new Error(
        `bullmq-autoqueue: ${found.configFile} must default-export a config object ` +
          `(got ${typeof config}).`,
      );
    }
  }
  const name = cfg.name ?? naming(found.folderName);
  return { ...cfg, name, processor: processor as QueueDefinition["processor"] };
}

/** Throw if two definitions share a queue name. */
export function assertUniqueNames(definitions: Array<Pick<QueueDefinition, "name">>): void {
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
