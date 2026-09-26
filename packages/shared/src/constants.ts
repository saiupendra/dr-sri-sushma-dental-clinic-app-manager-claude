/** Used to build reminder message text and the invoice PDF letterhead. */
export const CLINIC_NAME = "Dr.Sri Sushma Multispeciality Dental Clinic";

/** Letterhead facts printed on generated invoice PDFs. */
export const CLINIC_GSTIN = "36APBPY6938F1ZF";
export const CLINIC_ADDRESS = "Sanjay Apartment, beside Canara Bank, Anandbagh, Moula Ali, Hyderabad, Secunderabad, Telangana 500047";
export const CLINIC_PHONE = "+91 79958 15454";
export const CLINIC_EMAIL = "info@drsrisushmadentalclinic.com";
export const CLINIC_WEBSITE = "www.drsrisushmadentalclinic.com";
export const CLINIC_HOURS = "9:00 AM - 9:00 PM, 365 days";

/**
 * Staff roles. Admin is the system/operations role (staff accounts,
 * sessions, exports) and is never a treating clinician - clinical routes
 * stay gated to "doctor" specifically, never "admin". Doctor has full
 * clinical access plus day-to-day front-desk management; front-desk is
 * scoped. See requireRole() call sites in apps/api/src/routes.
 */
export const ROLES = ["admin", "doctor", "front_desk"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  admin: "Admin",
  doctor: "Doctor",
  front_desk: "Front desk",
};

export const APPOINTMENT_STATUSES = [
  "scheduled",
  "confirmed",
  "completed",
  "cancelled",
  "no_show",
  "rescheduled",
] as const;
export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];

/** Saving with one of these statuses offers to book a follow-up appointment - see AppointmentFormPage. */
export const APPOINTMENT_STATUSES_OFFERING_FOLLOWUP = ["rescheduled", "no_show", "cancelled"] as const;

export const INVOICE_STATUSES = [
  "unpaid",
  "partially_paid",
  "paid",
  "cancelled",
] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export const PAYMENT_METHODS = ["cash", "card", "upi", "amazon_pay", "netbanking", "other"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const FILE_TYPES = [
  "xray",
  "photo",
  "document",
  "other",
  "profile_photo",
  "before_treatment",
  "after_treatment",
] as const;
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
  "other",
] as const;
export type ToothCondition = (typeof TOOTH_CONDITIONS)[number];
