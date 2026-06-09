# Changelog

## 0.2.0

- **New: `bullmq-auto` CLI.** Scaffold a queue from the terminal — `npx bullmq-auto --generate "newqueue"` creates `queues/<name>/processor.*` (optionally `config.*` with `--config`). The generated folder is auto-discovered by the loader, so the queue, its worker, and the Bull Board entry register at startup with no central file to edit.
  - Auto-detects CJS vs ESM from the nearest `package.json`; override with `--ts` / `--esm` / `--cjs`. `--dir` sets the queues directory (default `./queues`); `--force` overwrites.
  - `bullmq-auto list` shows discovered queue folders under a directory.
- Programmatic API: `generateQueue`, `renderProcessor`, `renderConfig`, `detectStyle` are now exported for building custom scaffolders.

## 0.1.1

- Fix: Bull Board failed to load under ESM/dynamic-import consumers because the `@bull-board/api/bullMQAdapter` subpath is CJS-only and not ESM-resolvable. The dashboard packages are now loaded via `createRequire` (CJS resolution), resolved from the consumer's project. No API change.

## 0.1.0

Initial release.

- Convention-based queue discovery: a folder with `processor.{js,ts}` becomes a queue; optional `config.{js,ts}` tunes it. Grouping folders (no processor) are descended into; nested layouts supported.
- Automatic `Queue` + `Worker` wiring with injected `connection`, per-queue `concurrency`, merged `defaultJobOptions`, and completed/failed/error logging via a pluggable logger.
- Automatic Bull Board aggregation into a single mountable Express router (optional — `board: false` skips it and its peer deps).
- `QueueRegistry` with `add`, `queue`, `worker`, `names`, `size`, `closeAll`.
- `installGracefulShutdown` for SIGTERM/SIGINT.
- `defineQueue` / `defineConfig` typing helpers; explicit `queues` array as an alternative to folder scanning.
- Dual ESM/CJS build with type declarations.
