import type { JobsOptions } from "bullmq";
import type { QueueDefaults, QueueDefinition, ResolvedDefaults } from "./types";

const DEFAULTS: ResolvedDefaults = {
  concurrency: 1,
  defaultJobOptions: {},
  readOnlyBoard: true,
  autorun: true,
};

export function resolveDefaults(defaults: QueueDefaults | undefined): ResolvedDefaults {
  return {
    concurrency: defaults?.concurrency ?? DEFAULTS.concurrency,
    defaultJobOptions: defaults?.defaultJobOptions ?? DEFAULTS.defaultJobOptions,
    readOnlyBoard: defaults?.readOnlyBoard ?? DEFAULTS.readOnlyBoard,
    autorun: defaults?.autorun ?? DEFAULTS.autorun,
  };
}

/** What a queue actually runs with once its definition is merged over the defaults. */
export interface QueueSettings {
  name: string;
  concurrency: number;
  autorun: boolean;
  readOnlyBoard: boolean;
  defaultJobOptions: JobsOptions;
}

/** Merge a definition over the resolved defaults (definition wins, job options merge shallowly). */
export function resolveQueueSettings(
  def: Omit<QueueDefinition, "processor">,
  defaults: ResolvedDefaults,
): QueueSettings {
  return {
    name: def.name,
    concurrency: def.concurrency ?? defaults.concurrency,
    autorun: def.autorun ?? defaults.autorun,
    readOnlyBoard: def.readOnlyBoard ?? defaults.readOnlyBoard,
    defaultJobOptions: { ...defaults.defaultJobOptions, ...def.defaultJobOptions },
  };
}
