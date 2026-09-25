/** Used only to build reminder message text; all other clinic facts (address, hours) live outside this app. */
export const CLINIC_NAME = "Dr.Sri Sushma Multispeciality Dental Clinic";

/** Staff roles. Doctor has full access; front-desk is scoped (see requireRole() call sites in apps/api/src/routes). */
export const ROLES = ["doctor", "front_desk"] as const;
export type Role = (typeof ROLES)[number];

export const APPOINTMENT_STATUSES = [
  "scheduled",
  "confirmed",
  "completed",
  "cancelled",
  "no_show",
] as const;
export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];

export const INVOICE_STATUSES = [
  "unpaid",
  "partially_paid",
  "paid",
  "cancelled",
] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export const PAYMENT_METHODS = ["cash", "card", "upi", "netbanking", "other"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const FILE_TYPES = ["xray", "photo", "document", "other"] as const;
export type FileType = (typeof FILE_TYPES)[number];

export const REMINDER_CHANNELS = ["whatsapp", "sms"] as const;
export type ReminderChannel = (typeof REMINDER_CHANNELS)[number];

export const REMINDER_STATUSES = ["pending", "sent", "failed"] as const;
export type ReminderStatus = (typeof REMINDER_STATUSES)[number];

/**
 * FDI (ISO 3950) two-digit tooth notation, standard in Indian dental practice.
 * Quadrants: 1 upper-right, 2 upper-left, 3 lower-left, 4 lower-right.
 * Permanent teeth only (1-8 per quadrant) for v1; deciduous (5x-8x) can be added later.
 */
export const FDI_PERMANENT_TEETH: readonly string[] = [
  ...[1, 2, 3, 4].flatMap((quadrant) =>
    Array.from({ length: 8 }, (_, i) => `${quadrant}${i + 1}`),
  ),
];

export const TOOTH_CONDITIONS = [
  "healthy",
  "decayed",
  "filled",
  "crown",
  "root_canal_treated",
  "missing",
  "implant",
  "extraction_planned",
  "impacted",
  "fractured",
] as const;
export type ToothCondition = (typeof TOOTH_CONDITIONS)[number];
