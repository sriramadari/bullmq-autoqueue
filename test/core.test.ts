import { describe, expect, it } from "vitest";
import {
  assertUniqueNames,
  discoverQueueFolders,
  renderProcessor,
  resolveDefaults,
  resolveQueueSettings,
  toKebabCase,
  toQueueDefinition,
  type DirEntry,
} from "../src/core";

/** A virtual tree: directories map to entries, files are `null`. */
type Tree = { [name: string]: Tree | null };

function lister(tree: Tree) {
  return (dir: string): DirEntry[] => {
    let node: Tree | null = tree;
    for (const part of dir.split("/").filter(Boolean)) node = node?.[part] ?? null;
    if (!node) throw new Error(`no such dir: ${dir}`);
    return Object.entries(node).map(([name, child]) => ({ name, isDirectory: child !== null }));
  };
}

const tree: Tree = {
  queues: {
    sendNotificationFollowers: { "processor.js": null, helpers: { "processor.js": null } },
    emailQueues: { otpEmail: { "processor.ts": null, "config.ts": null } },
    node_modules: { pkg: { "processor.js": null } },
    ".cache": { x: { "processor.js": null } },
    README: { "notes.md": null },
  },
};

describe("discoverQueueFolders", () => {
  it("applies the folder convention to any directory lister", async () => {
    const found = await discoverQueueFolders("queues", lister(tree));
    expect(found).toEqual([
      {
        dir: "queues/sendNotificationFollowers",
        folderName: "sendNotificationFollowers",
        processorFile: "queues/sendNotificationFollowers/processor.js",
        configFile: null,
      },
      {
        dir: "queues/emailQueues/otpEmail",
        folderName: "otpEmail",
        processorFile: "queues/emailQueues/otpEmail/processor.ts",
        configFile: "queues/emailQueues/otpEmail/config.ts",
      },
    ]);
  });

  it("treats a root that holds a processor as a single queue named after the root", async () => {
    const found = await discoverQueueFolders("reelUpload", lister({ reelUpload: { "processor.mjs": null } }));
    expect(found.map((f) => f.folderName)).toEqual(["reelUpload"]);
  });
});

describe("toQueueDefinition", () => {
  const found = { dir: "q/otpEmail", folderName: "otpEmail", processorFile: "p.js", configFile: "c.js" };
  const fn = async () => ({ ok: true });

  it("derives the name from the folder and lets config override it", () => {
    expect(toQueueDefinition({ ...found, configFile: null }, fn, undefined, toKebabCase).name).toBe("otp-email");
    expect(toQueueDefinition(found, fn, { name: "otp-emails", concurrency: 20 }, toKebabCase)).toMatchObject({
      name: "otp-emails",
      concurrency: 20,
    });
  });

  it("rejects a non-function processor or a non-object config", () => {
    expect(() => toQueueDefinition(found, "nope", {}, toKebabCase)).toThrow(/must default-export a processor function/);
    expect(() => toQueueDefinition(found, fn, 42, toKebabCase)).toThrow(/must default-export a config object/);
  });
});

describe("resolveQueueSettings", () => {
  it("merges a definition over defaults, job options shallowly", () => {
    const defaults = resolveDefaults({ concurrency: 5, defaultJobOptions: { attempts: 3, removeOnComplete: 100 } });
    expect(resolveQueueSettings({ name: "a", defaultJobOptions: { attempts: 2 } }, defaults)).toEqual({
      name: "a",
      concurrency: 5,
      autorun: true,
      readOnlyBoard: true,
      defaultJobOptions: { attempts: 2, removeOnComplete: 100 },
    });
  });
});

describe("core entry", () => {
  it("re-exports the scaffold renderers and duplicate check", () => {
    expect(renderProcessor("otp-email", "esm")).toContain("export default async function otpEmailProcessor");
    expect(() => assertUniqueNames([{ name: "a" }, { name: "a" }])).toThrow(/duplicate queue name "a"/);
  });
});
