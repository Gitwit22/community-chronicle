import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "server",
    environment: "node",
    globals: true,
    setupFiles: ["./server/test/setup.ts"],
    include: ["./server/test/**/*.{test,spec}.ts"],
  },
});
