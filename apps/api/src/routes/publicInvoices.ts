import { Hono } from "hono";
import { z } from "zod";
import { idParamSchema } from "@clinic/shared";
import { getDb } from "../db/client.js";
import { loadInvoicePdfBytes } from "./invoices.js";
import { notFound } from "../lib/responses.js";
import { validate } from "../lib/validate.js";
import type { AppContext } from "../types.js";

// Deliberately outside requireAuth: this app has no patient-facing login, so
// a patient opening their invoice from a WhatsApp link can't carry a staff
// session cookie. The unguessable per-invoice share token (see
// invoices.shareToken) stands in for auth here - anyone without the exact
// link gets the same 404 as a wrong invoice ID, never a hint that the ID
// exists. Never add a route here that doesn't check the token.
export const publicInvoiceRoutes = new Hono<AppContext>();

const paramSchema = idParamSchema.extend({ token: z.string().min(1) });

publicInvoiceRoutes.get("/:id/:token/pdf", validate("param", paramSchema), async (c) => {
  const { id, token } = c.req.valid("param");
  const db = getDb(c.env);
  const pdfBytes = await loadInvoicePdfBytes(db, id, token);
  if (!pdfBytes) throw notFound("Invoice");
  return new Response(pdfBytes, {
    headers: {
      "Content-Type": "application/pdf",
      // Inline, not attachment: this is opened directly from a WhatsApp
      // link on the patient's own phone, where seeing it render immediately
      // in the browser is the friendlier default - they can still save or
      // share it from there. The staff-side route in invoices.ts is the
      // opposite on purpose (see its own comment).
      "Content-Disposition": `inline; filename="invoice-${id.slice(0, 8)}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
});
