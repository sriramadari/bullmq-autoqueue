# Changelog

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
