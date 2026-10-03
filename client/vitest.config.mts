import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // Integration tests need a database; they run via vitest.integration.config.mts.
    exclude: ["src/**/*.int.test.ts", "node_modules/**"],
  },
});
