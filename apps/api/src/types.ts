import type { StaffPublic } from "@clinic/shared";

export interface Env {
  DB: D1Database;
  FILES: R2Bucket;
  ENVIRONMENT: "development" | "staging" | "production";
  ALLOWED_ORIGIN: string;
  COOKIE_DOMAIN: string;
}

/** Populated by the auth middleware once a session cookie has been verified. */
export interface AuthedVariables {
  currentUser: StaffPublic;
}

export type AppContext = {
  Bindings: Env;
  Variables: AuthedVariables;
};
