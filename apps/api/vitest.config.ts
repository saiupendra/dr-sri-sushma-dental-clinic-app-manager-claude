import { defineConfig } from "vitest/config";

// Plain Node vitest, deliberately not the Workers runtime plugin: the routes
// that touch D1/R2 are integration surface covered by the Playwright e2e
// specs in apps/web/e2e (see docs/testing.md). What's unit-tested here is the
// pure business logic extracted into src/lib/* (crypto, scheduling, billing,
// whatsapp), which needs no Workers runtime and runs fast under plain Node.
export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
  },
});
