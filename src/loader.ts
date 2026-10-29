import { existsSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { discoverQueueFolders, toQueueDefinition } from "./discover";
import type { QueueDefinition } from "./types";

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

async function listDir(dir: string) {
  const entries = await readdir(dir, { withFileTypes: true });
  return entries.map((e) => ({ name: e.name, isDirectory: e.isDirectory() }));
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

  const discovered = await discoverQueueFolders(root, listDir, join);
  const definitions: QueueDefinition[] = [];

  for (const found of discovered) {
    const processor = await importDefault(found.processorFile);
    const config = found.configFile ? await importDefault(found.configFile) : undefined;
    definitions.push(toQueueDefinition(found, processor, config, naming));
  }

  return definitions;
}
