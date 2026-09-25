import { defineConfig } from "drizzle-kit";

// `generate` only diffs src/db/schema.ts against migrations/ and needs no live
// credentials. We never run `drizzle-kit push`/`studio` against D1 directly —
// migrations are generated here, then applied with `wrangler d1 migrations apply`
// (see package.json db:migrate:* scripts) so local, staging and production all
// go through the same reviewable SQL files in migrations/.
export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./migrations",
  dialect: "sqlite",
});
