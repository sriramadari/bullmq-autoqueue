#!/usr/bin/env node
import { existsSync, readdirSync } from "node:fs";
import { relative, resolve } from "node:path";
import { parseArgs } from "node:util";
import { generateQueue, type CodeStyle } from "./generate";

const useColor = process.stdout.isTTY && !process.env.NO_COLOR;
const c = {
  dim: (s: string) => (useColor ? `\x1b[2m${s}\x1b[0m` : s),
  bold: (s: string) => (useColor ? `\x1b[1m${s}\x1b[0m` : s),
  green: (s: string) => (useColor ? `\x1b[32m${s}\x1b[0m` : s),
  cyan: (s: string) => (useColor ? `\x1b[36m${s}\x1b[0m` : s),
  red: (s: string) => (useColor ? `\x1b[31m${s}\x1b[0m` : s),
};

const HELP = `bullmq-auto — scaffolding CLI for bullmq-autoqueue

Usage:
  bullmq-auto --generate <name> [options]
  bullmq-auto generate <name> [options]
  bullmq-auto list [--dir <queues>]

Generate options:
  --dir <path>     Queues directory (default: ./queues)
  --config         Also create a config file (concurrency/retry overrides)
  --ts             Emit TypeScript (default: auto-detect cjs/esm from package.json)
  --esm            Force ESM output
  --cjs            Force CommonJS output
  --force          Overwrite existing files
  -h, --help       Show this help

The generated folder is auto-discovered by bullmq-autoqueue — its Queue, Worker,
and Bull Board entry are created at startup. There is no central registry to edit.

Examples:
  npx bullmq-auto --generate newqueue
  npx bullmq-auto --generate "send welcome email" --config
  npx bullmq-auto --generate reindexSearch --dir ./queues --ts
`;

function die(message: string): never {
  process.stderr.write(c.red(`error: ${message}`) + "\n");
  process.exit(1);
}

function resolveStyle(values: Record<string, unknown>): CodeStyle | undefined {
  if (values.ts) return "ts";
  if (values.esm) return "esm";
  if (values.cjs) return "cjs";
  return undefined; // auto-detect
}

function cmdGenerate(name: string | undefined, values: Record<string, unknown>): void {
  if (!name) die('a queue name is required, e.g. bullmq-auto --generate "newqueue"');
  const dir = resolve((values.dir as string) || "queues");
  let result;
  try {
    result = generateQueue({
      name,
      dir,
      style: resolveStyle(values),
      withConfig: Boolean(values.config),
      force: Boolean(values.force),
    });
  } catch (err) {
    die((err as Error).message);
  }

  const rel = (p: string) => relative(process.cwd(), p) || p;
  process.stdout.write(
    c.green(`✓ created queue "${result.queueName}"`) + c.dim(` (${result.style})`) + "\n",
  );
  for (const f of result.files) process.stdout.write(`  ${c.cyan(rel(f))}\n`);
  process.stdout.write(
    "\n" +
      c.dim("Next:\n") +
      c.dim(`  • Implement the job logic in ${rel(result.files[0] as string)}\n`) +
      c.dim(`  • Restart your app — the queue + Bull Board entry register automatically\n`) +
      c.dim(`  • Enqueue:  registry.add("${result.queueName}", "jobName", { /* data */ })\n`),
  );
}

function cmdList(values: Record<string, unknown>): void {
  const dir = resolve((values.dir as string) || "queues");
  if (!existsSync(dir)) die(`queues directory not found: ${dir}`);
  const SCRIPT = /^processor\.(js|mjs|cjs|ts)$/;
  const found: string[] = [];
  const walk = (d: string) => {
    const entries = readdirSync(d, { withFileTypes: true });
    if (entries.some((e) => e.isFile() && SCRIPT.test(e.name))) {
      found.push(relative(dir, d) || ".");
      return;
    }
    for (const e of entries) {
      if (e.isDirectory() && !e.name.startsWith(".") && e.name !== "node_modules") {
        walk(resolve(d, e.name));
      }
    }
  };
  walk(dir);
  process.stdout.write(c.bold(`${found.length} queue folder(s) under ${relative(process.cwd(), dir) || dir}:\n`));
  for (const f of found.sort()) process.stdout.write(`  ${c.cyan(f)}\n`);
}

function main(): void {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      generate: { type: "string", short: "g" },
      dir: { type: "string" },
      config: { type: "boolean", default: false },
      ts: { type: "boolean", default: false },
      esm: { type: "boolean", default: false },
      cjs: { type: "boolean", default: false },
      force: { type: "boolean", default: false },
      help: { type: "boolean", short: "h", default: false },
    },
  });

  if (values.help) {
    process.stdout.write(HELP);
    return;
  }

  // `--generate <name>` (flag form) or `generate <name>` (subcommand form).
  if (typeof values.generate === "string") {
    return cmdGenerate(values.generate, values);
  }

  const [command, ...rest] = positionals;
  switch (command) {
    case undefined:
      process.stdout.write(HELP);
      return;
    case "generate":
    case "g":
      return cmdGenerate(rest[0], values);
    case "list":
    case "ls":
      return cmdList(values);
    default:
      die(`unknown command "${command}". Run with --help for usage.`);
  }
}

main();
