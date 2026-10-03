import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

// Route-handler tests against a real Postgres database (see
// src/test-utils/integration/testDbUrl.ts for which one). Run with
// `npm run test:integration`; `npm test` stays DB-free.
export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    include: ["src/**/*.int.test.ts"],
    globalSetup: ["src/test-utils/integration/globalSetup.ts"],
    // env.ts must come first: it points DATABASE_URL at the test database
    // before setup.ts loads the Prisma client.
    setupFiles: ["src/test-utils/integration/env.ts", "src/test-utils/integration/setup.ts"],
    // Files share one database and truncate it between tests.
    fileParallelism: false,
  },
});
