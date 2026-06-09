import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { detectStyle, generateQueue, renderConfig, renderProcessor } from "../src/generate";
import { loadDefinitionsFromDir } from "../src/loader";
import { toKebabCase } from "../src/naming";

const ROOT = join(tmpdir(), "bullmq-autoqueue-gen-test");
const QUEUES = join(ROOT, "queues");

beforeEach(() => {
  rmSync(ROOT, { recursive: true, force: true });
  mkdirSync(ROOT, { recursive: true });
});
afterEach(() => rmSync(ROOT, { recursive: true, force: true }));

describe("renderProcessor", () => {
  it("emits CJS by default", () => {
    const src = renderProcessor("new-queue", "cjs");
    expect(src).toContain("module.exports = async function");
    expect(src).toContain('registry.add("new-queue"');
  });
  it("emits ESM and TS variants", () => {
    expect(renderProcessor("x", "esm")).toContain("export default async function");
    const ts = renderProcessor("x", "ts");
    expect(ts).toContain('import type { Job } from "bullmq"');
    expect(ts).toContain("job: Job");
  });
  it("uses a safe identifier derived from the queue name", () => {
    expect(renderProcessor("send welcome email", "cjs")).toContain("sendWelcomeEmailProcessor");
  });
});

describe("renderConfig", () => {
  it("uses defineConfig for TS and plain object otherwise", () => {
    expect(renderConfig("q", "ts")).toContain('import { defineConfig } from "bullmq-autoqueue"');
    expect(renderConfig("q", "cjs")).toContain("module.exports = {");
    expect(renderConfig("q", "esm")).toContain("export default {");
  });
});

describe("detectStyle", () => {
  it("returns esm when nearest package.json is type module, else cjs", () => {
    writeFileSync(join(ROOT, "package.json"), JSON.stringify({ type: "module" }));
    expect(detectStyle(ROOT)).toBe("esm");
    writeFileSync(join(ROOT, "package.json"), JSON.stringify({ type: "commonjs" }));
    expect(detectStyle(ROOT)).toBe("cjs");
  });
});

describe("generateQueue", () => {
  it("kebab-cases the name and writes processor only by default", () => {
    const res = generateQueue({ name: "MyNewQueue", dir: QUEUES, style: "cjs" });
    expect(res.queueName).toBe("my-new-queue");
    expect(res.files).toHaveLength(1);
    expect(existsSync(join(QUEUES, "my-new-queue", "processor.js"))).toBe(true);
    expect(readFileSync(res.files[0]!, "utf8")).toContain("module.exports");
  });

  it("also writes config when requested", () => {
    const res = generateQueue({ name: "withcfg", dir: QUEUES, style: "cjs", withConfig: true });
    expect(res.files).toHaveLength(2);
    expect(existsSync(join(QUEUES, "withcfg", "config.js"))).toBe(true);
  });

  it("refuses to overwrite without force", () => {
    generateQueue({ name: "dupe", dir: QUEUES, style: "cjs" });
    expect(() => generateQueue({ name: "dupe", dir: QUEUES, style: "cjs" })).toThrow(/already exists/);
    expect(() => generateQueue({ name: "dupe", dir: QUEUES, style: "cjs", force: true })).not.toThrow();
  });

  it("rejects an empty name", () => {
    expect(() => generateQueue({ name: "  ", dir: QUEUES })).toThrow(/invalid queue name/);
  });

  it("produces a queue the loader auto-discovers", async () => {
    // Mark the tmp project CJS so the generated .js processor is importable.
    writeFileSync(join(ROOT, "package.json"), JSON.stringify({ type: "commonjs" }));
    generateQueue({ name: "reindex-search", dir: QUEUES, style: "cjs", withConfig: true });

    const defs = await loadDefinitionsFromDir(QUEUES, toKebabCase);
    expect(defs).toHaveLength(1);
    expect(defs[0]!.name).toBe("reindex-search");
    expect(typeof defs[0]!.processor).toBe("function");
    // config.js defaults flow through
    expect(defs[0]!.concurrency).toBe(5);
  });
});
