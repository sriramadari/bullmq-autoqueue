import { describe, expect, it } from "vitest";
import { resolveDefaults } from "../src/factory";
import { QueueRegistry } from "../src/registry";
import { consoleLogger } from "../src/logger";

describe("resolveDefaults", () => {
  it("fills in fallbacks", () => {
    expect(resolveDefaults(undefined)).toEqual({
      concurrency: 1,
      defaultJobOptions: {},
      readOnlyBoard: true,
      autorun: true,
    });
  });

  it("respects provided values", () => {
    const r = resolveDefaults({ concurrency: 8, readOnlyBoard: false });
    expect(r.concurrency).toBe(8);
    expect(r.readOnlyBoard).toBe(false);
    expect(r.autorun).toBe(true); // still defaulted
  });
});

describe("QueueRegistry", () => {
  it("reports names/size and errors on unknown queue (no Redis needed)", async () => {
    const registry = new QueueRegistry([], consoleLogger);
    expect(registry.size).toBe(0);
    expect(registry.names).toEqual([]);
    await expect(registry.add("missing", "job", {})).rejects.toThrow(/no queue named "missing"/);
  });
});
