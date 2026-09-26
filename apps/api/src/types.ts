import type { StaffPublic } from "@clinic/shared";

export interface Env {
  DB: D1Database;
  FILES: R2Bucket;
  ENVIRONMENT: "development" | "staging" | "production";
  ALLOWED_ORIGIN: string;
  COOKIE_DOMAIN: string;
  // Optional: set via `wrangler secret put` (the token) and `[vars]` (the
  // rest) once a Meta WhatsApp Business Cloud API account and an approved
  // template exist - see lib/whatsappCloudApi.ts. The automatic
  // completed-appointment message is silently skipped, not an error, until
  // all three are present.
  WHATSAPP_CLOUD_API_TOKEN?: string;
  WHATSAPP_PHONE_NUMBER_ID?: string;
  WHATSAPP_COMPLETED_TEMPLATE_NAME?: string;
  WHATSAPP_COMPLETED_TEMPLATE_LANG?: string;
}

/** Populated by the auth middleware once a session cookie has been verified. */
export interface AuthedVariables {
  currentUser: StaffPublic;
}

export type AppContext = {
  Bindings: Env;
  Variables: AuthedVariables;
};
