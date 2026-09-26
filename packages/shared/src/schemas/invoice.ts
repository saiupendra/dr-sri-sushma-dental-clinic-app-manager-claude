import { z } from "zod";
import { INVOICE_STATUSES, PAYMENT_METHODS } from "../constants.js";
import {
  idSchema,
  isoDateTimeSchema,
  paginationQuerySchema,
  timestampsSchema,
} from "./common.js";

export const invoiceItemSchema = z.object({
  id: idSchema,
  invoiceId: idSchema,
  treatmentRecordId: idSchema.nullable(),
  description: z.string().min(1).max(300),
  amount: z.number().nonnegative(),
  units: z.number().int().min(1).max(999),
});
export type InvoiceItem = z.infer<typeof invoiceItemSchema>;

export const createInvoiceItemSchema = z.object({
  id: idSchema.optional(),
  treatmentRecordId: idSchema.optional(),
  description: z.string().min(1).max(300),
  amount: z.number().nonnegative(),
  units: z.number().int().min(1).max(999).default(1),
});
export type CreateInvoiceItemInput = z.infer<typeof createInvoiceItemSchema>;

export const paymentSchema = z.object({
  id: idSchema,
  invoiceId: idSchema,
  amount: z.number().positive(),
  method: z.enum(PAYMENT_METHODS),
  paidAt: isoDateTimeSchema,
  note: z.string().max(500).nullable(),
  recordedBy: idSchema,
});
export type Payment = z.infer<typeof paymentSchema>;

export const recordPaymentSchema = z.object({
  id: idSchema.optional(),
  amount: z.number().positive(),
  method: z.enum(PAYMENT_METHODS),
  paidAt: isoDateTimeSchema.optional(),
  note: z.string().max(500).optional(),
});
export type RecordPaymentInput = z.infer<typeof recordPaymentSchema>;

export const invoiceSchema = z
  .object({
    id: idSchema,
    patientId: idSchema,
    status: z.enum(INVOICE_STATUSES),
    // Set once, server-side, at creation (see POST /api/invoices) - not
    // user-editable, so it reflects exactly when the invoice was issued.
    date: isoDateTimeSchema,
    totalAmount: z.number().nonnegative(),
    amountPaid: z.number().nonnegative(),
    notes: z.string().max(2000).nullable(),
    createdBy: idSchema.nullable(),
    // Unguessable, set at creation - the frontend uses it to build the
    // public /api/public/invoices/:id/:token/pdf link for "Send via WhatsApp".
    shareToken: z.string().nullable(),
    items: z.array(invoiceItemSchema),
    payments: z.array(paymentSchema),
  })
  .merge(timestampsSchema);
export type Invoice = z.infer<typeof invoiceSchema>;

export const createInvoiceSchema = z.object({
  id: idSchema.optional(),
  patientId: idSchema,
  notes: z.string().max(2000).optional(),
  // No .min(1): the server always prepends a "Consultation fee" line from
  // the patient's own record (see POST /api/invoices), so an invoice with
  // no *additional* charges is still a valid, non-empty invoice.
  items: z.array(createInvoiceItemSchema),
});
export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;

export const invoiceListQuerySchema = paginationQuerySchema
  .omit({ search: true })
  .extend({ patientId: idSchema.optional() });
export type InvoiceListQuery = z.infer<typeof invoiceListQuerySchema>;

export const updateInvoiceSchema = z.object({
  status: z.enum(INVOICE_STATUSES).optional(),
  notes: z.string().max(2000).nullable().optional(),
  // See createInvoiceSchema.items - same "server always adds the
  // consultation fee back in" rule applies when items are replaced here.
  items: z.array(createInvoiceItemSchema).optional(),
});
export type UpdateInvoiceInput = z.infer<typeof updateInvoiceSchema>;
