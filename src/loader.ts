import { existsSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { basename, join } from "node:path";
import { pathToFileURL } from "node:url";
import type { QueueConfig, QueueDefinition } from "./types";

/** Runtime-resolvable script extensions, in resolution order. */
const SCRIPT_EXTS = [".js", ".mjs", ".cjs", ".ts"];
const PROCESSOR_BASE = "processor";
const CONFIG_BASE = "config";
const IGNORED_DIRS = new Set(["node_modules", "dist", "build", "coverage"]);

interface DiscoveredQueue {
  dir: string;
  processorFile: string;
  configFile: string | null;
}

function findFile(dir: string, base: string): string | null {
  for (const ext of SCRIPT_EXTS) {
    const candidate = join(dir, base + ext);
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

/**
 * Resolve the default export of a module, tolerating both ESM (`export default`)
 * and CJS (`module.exports = …`) shapes.
 */
async function importDefault(file: string): Promise<unknown> {
  const mod: any = await import(pathToFileURL(file).href);
  // For CJS interop, `import()` puts `module.exports` on `.default`; for a
  // module that set `module.exports = fn`, both `mod.default` and `mod` may be
  // relevant. Prefer an explicit default, fall back to the namespace.
  if (mod && typeof mod === "object" && "default" in mod) {
    const d = mod.default;
    // Some bundlers double-wrap: { default: { default: fn } }
    if (d && typeof d === "object" && "default" in d && Object.keys(d).length === 1) {
      return d.default;
    }
    return d;
  }
  return mod;
}

/**
 * Walk `root`. A directory that directly contains a `processor.*` file is a
 * queue (we do not descend into it — its subfolders are private helpers). Any
 * other directory is a grouping folder and we descend into it. This handles
 * nested layouts like `queues/emailQueues/otpEmail/processor.js`.
 */
async function discover(root: string): Promise<DiscoveredQueue[]> {
  const found: DiscoveredQueue[] = [];

  async function walk(dir: string): Promise<void> {
    const processorFile = findFile(dir, PROCESSOR_BASE);
    if (processorFile) {
      found.push({ dir, processorFile, configFile: findFile(dir, CONFIG_BASE) });
      return;
    }
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (entry.name.startsWith(".") || IGNORED_DIRS.has(entry.name)) continue;
      await walk(join(dir, entry.name));
    }
  }

  await walk(root);
  return found;
}

/**
 * Load queue definitions from a directory tree using the folder convention.
 *
 * @param root   Directory to scan.
 * @param naming Folder-name → queue-name mapper.
 */
export async function loadDefinitionsFromDir(
  root: string,
  naming: (folderName: string) => string,
): Promise<QueueDefinition[]> {
  if (!existsSync(root)) {
    throw new Error(`bullmq-autoqueue: queue directory not found: ${root}`);
  }

  const discovered = await discover(root);
  const definitions: QueueDefinition[] = [];

  for (const { dir, processorFile, configFile } of discovered) {
    const processor = await importDefault(processorFile);
    if (typeof processor !== "function") {
      throw new Error(
        `bullmq-autoqueue: ${processorFile} must default-export a processor function ` +
          `(got ${typeof processor}).`,
      );
    }

    let config: QueueConfig = {};
    if (configFile) {
      const loaded = await importDefault(configFile);
      if (loaded && typeof loaded === "object") {
        config = loaded as QueueConfig;
      } else {
        throw new Error(
          `bullmq-autoqueue: ${configFile} must default-export a config object ` +
            `(got ${typeof loaded}).`,
        );
      }
    }

    const name = config.name ?? naming(basename(dir));
    definitions.push({ ...config, name, processor: processor as QueueDefinition["processor"] });
  }

  return definitions;
}
