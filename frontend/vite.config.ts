import { defineConfig } from "vitest/config";
import vue from "@vitejs/plugin-vue";

// Specs live in __spec__ folders next to the code. The suffix picks the kind
// by what a spec exercises: unit for one module's logic with nothing rendered,
// ui for one component or composable rendered on its own, int for anything
// that checks real storage or goes deeper than what the ui shows.
export default defineConfig({
  plugins: [vue()],
  server: {
    port: 3000,
    // Fail on a busy port instead of moving to the next one, so a second
    // dev server never starts unnoticed.
    strictPort: true,
  },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          include: ["src/**/__spec__/*.spec.unit.ts"],
          environment: "node",
        },
      },
      {
        extends: true,
        test: {
          name: "ui",
          include: ["src/**/__spec__/*.spec.ui.{ts,tsx}"],
          environment: "jsdom",
          setupFiles: ["src/__spec__/setup.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "int",
          include: ["src/**/__spec__/*.spec.int.{ts,tsx}"],
          environment: "jsdom",
          setupFiles: ["src/__spec__/setup.ts"],
        },
      },
    ],
  },
});
