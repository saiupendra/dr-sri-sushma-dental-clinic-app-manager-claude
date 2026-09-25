import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema.js";
import type { Env } from "../types.js";

export type Db = ReturnType<typeof getDb>;

export function getDb(env: Env) {
  return drizzle(env.DB, { schema });
}
