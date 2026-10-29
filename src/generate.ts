import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, parse } from "node:path";
import { toKebabCase } from "./naming";
import { ext, renderConfig, renderProcessor, type CodeStyle } from "./templates";

export { renderConfig, renderProcessor };
export type { CodeStyle };

export interface GenerateOptions {
  /** Raw queue name as typed by the user (kebab-cased for the folder + queue name). */
  name: string;
  /** Directory the queue folder is created under. Default: `./queues`. */
  dir?: string;
  /** Force a specific code style. Default: auto-detected from the nearest package.json. */
  style?: CodeStyle;
  /** Also emit a `config.*` with concurrency/retry defaults. Default: false. */
  withConfig?: boolean;
  /** Overwrite existing files instead of erroring. Default: false. */
  force?: boolean;
}

export interface GenerateResult {
  /** The resolved queue name (kebab-case). */
  queueName: string;
  /** Absolute path to the created queue folder. */
  folder: string;
  /** Absolute paths of files written. */
  files: string[];
  style: CodeStyle;
}

/**
 * Detect the code style for a target directory by walking up to the nearest
 * `package.json`: `"type": "module"` → ESM, otherwise CJS. (TS is opt-in.)
 */
export function detectStyle(dir: string): CodeStyle {
  let current = existsSync(dir) ? dir : dirname(dir);
  const { root } = parse(current);
  for (;;) {
    const pkg = join(current, "package.json");
    if (existsSync(pkg)) {
      try {
        const json = JSON.parse(readFileSync(pkg, "utf8")) as { type?: string };
        return json.type === "module" ? "esm" : "cjs";
      } catch {
        return "cjs";
      }
    }
    if (current === root) return "cjs";
    current = dirname(current);
  }
}

/**
 * Scaffold a new queue folder (`<dir>/<queue-name>/processor.*`, optionally
 * `config.*`). The queue is auto-registered with both BullMQ and Bull Board the
 * next time {@link loadQueues} runs — there is no central file to edit.
 *
 * @throws if the name is empty, or files exist and `force` is not set.
 */
export function generateQueue(options: GenerateOptions): GenerateResult {
  const queueName = toKebabCase(options.name).replace(/^-+|-+$/g, "");
  if (!queueName) {
    throw new Error(`bullmq-autoqueue: invalid queue name "${options.name}"`);
  }
  const dir = options.dir ?? join(process.cwd(), "queues");
  const style = options.style ?? detectStyle(dir);
  const folder = join(dir, queueName);

  const files: string[] = [];
  const targets: Array<[string, string]> = [
    [join(folder, `processor${ext[style]}`), renderProcessor(queueName, style)],
  ];
  if (options.withConfig) {
    targets.push([join(folder, `config${ext[style]}`), renderConfig(queueName, style)]);
  }

  if (!options.force) {
    for (const [path] of targets) {
      if (existsSync(path)) {
        throw new Error(`bullmq-autoqueue: ${path} already exists (use --force to overwrite)`);
      }
    }
  }

  mkdirSync(folder, { recursive: true });
  for (const [path, content] of targets) {
    writeFileSync(path, content, "utf8");
    files.push(path);
  }

  return { queueName, folder, files, style };
}
