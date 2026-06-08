import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  sourcemap: true,
  treeshake: true,
  target: "node18",
  // Keep peers external so consumers' installed versions are used.
  external: ["bullmq", "@bull-board/api", "@bull-board/express", "@bull-board/api/bullMQAdapter"],
});
