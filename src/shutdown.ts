import type { QueueRegistry } from "./registry";

export interface ShutdownOptions {
  /** Signals to listen for. Default: `["SIGTERM", "SIGINT"]`. */
  signals?: NodeJS.Signals[];
  /** Called after queues close, before `process.exit`. */
  onClose?: () => void | Promise<void>;
  /** Exit the process after closing. Default: `true`. Set `false` if you manage exit yourself. */
  exit?: boolean;
}

/**
 * Wire `SIGTERM`/`SIGINT` to close all queues before the process exits.
 * Idempotent — repeated signals during shutdown are ignored.
 */
export function installGracefulShutdown(registry: QueueRegistry, options: ShutdownOptions = {}): void {
  const signals = options.signals ?? (["SIGTERM", "SIGINT"] as NodeJS.Signals[]);
  const exit = options.exit ?? true;
  let closing = false;

  for (const signal of signals) {
    process.once(signal, async () => {
      if (closing) return;
      closing = true;
      try {
        await registry.closeAll();
        await options.onClose?.();
      } finally {
        if (exit) process.exit(0);
      }
    });
  }
}
