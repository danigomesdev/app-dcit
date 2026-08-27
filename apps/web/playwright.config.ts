import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  // Some tests seed the shared fake-api-server's in-memory state (see its
  // header comment) — running fully parallel risks one test's seeded
  // response leaking into another's request. The suite is small enough
  // that serial execution costs little.
  workers: 1,
  webServer: [
    {
      command: "node e2e/fake-api-server.mjs",
      url: "http://localhost:3000/__requests",
      reuseExistingServer: !process.env.CI,
    },
    {
      command: "pnpm dev",
      url: "http://localhost:3001",
      reuseExistingServer: !process.env.CI,
    },
  ],
  use: {
    baseURL: "http://localhost:3001",
  },
});
