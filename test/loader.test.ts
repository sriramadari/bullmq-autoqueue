import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadDefinitionsFromDir } from "../src/loader";
import { toKebabCase } from "../src/naming";

const here = dirname(fileURLToPath(import.meta.url));
const fixtures = join(here, "fixtures", "queues");

describe("loadDefinitionsFromDir", () => {
  it("discovers queues, descends grouping folders, and derives/overrides names", async () => {
    const defs = await loadDefinitionsFromDir(fixtures, toKebabCase);
    const byName = Object.fromEntries(defs.map((d) => [d.name, d]));

    // top-level camelCase folder -> kebab name
    expect(byName["send-notification-followers"]).toBeTruthy();
    expect(byName["reel-upload"]).toBeTruthy();

    // nested grouping folder (emailQueues) descended into; config.name override applied
    expect(byName["otp-emails"]).toBeTruthy();
    expect(byName["otp-emails"].concurrency).toBe(20);

    // every definition has a callable processor
    for (const def of defs) {
      expect(typeof def.processor).toBe("function");
    }

    // exactly the three queues, nothing from helper subfolders
    expect(defs).toHaveLength(3);
  });

  it("throws a clear error when a processor is not a function", async () => {
    const bad = join(here, "fixtures", "bad");
    await expect(loadDefinitionsFromDir(bad, toKebabCase)).rejects.toThrow(
      /must default-export a processor function/,
    );
  });

  it("throws when the directory does not exist", async () => {
    await expect(loadDefinitionsFromDir(join(here, "nope"), toKebabCase)).rejects.toThrow(
      /queue directory not found/,
    );
  });
});
