import { sql } from "drizzle-orm";
import { index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

const timestamps = {
  createdAt: text("created_at")
    .notNull()
    .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`),
};

export const staff = sqliteTable(
  "staff",
  {
    id: text("id").primaryKey(),
    username: text("username").notNull(),
    name: text("name").notNull(),
    role: text("role").notNull(), // 'doctor' | 'front_desk'
    phone: text("phone"),
    passwordHash: text("password_hash").notNull(),
    passwordSalt: text("password_salt").notNull(),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    ...timestamps,
  },
  (t) => ({
    usernameUnique: uniqueIndex("staff_username_unique").on(t.username),
  }),
);

/** Server-side session store. The cookie carries the raw token; we store only its SHA-256 hash. */
export const sessions = sqliteTable(
  "sessions",
  {
    id: text("id").primaryKey(), // hash of the raw token
    staffId: text("staff_id")
      .notNull()
      .references(() => staff.id),
    userAgent: text("user_agent"),
    lastUsedAt: text("last_used_at")
      .notNull()
      .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`),
    expiresAt: text("expires_at").notNull(),
    createdAt: timestamps.createdAt,
  },
  (t) => ({
    staffIdx: index("sessions_staff_idx").on(t.staffId),
  }),
);

export const patients = sqliteTable(
  "patients",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    phone: text("phone").notNull(),
    email: text("email"),
    dateOfBirth: text("date_of_birth"),
    sex: text("sex").notNull().default("unspecified"),
    address: text("address"),
    medicalHistoryNotes: text("medical_history_notes"),
    createdBy: text("created_by").references(() => staff.id),
    deletedAt: text("deleted_at"),
    ...timestamps,
  },
  (t) => ({
    nameIdx: index("patients_name_idx").on(t.name),
    phoneIdx: index("patients_phone_idx").on(t.phone),
  }),
);

export const appointments = sqliteTable(
  "appointments",
  {
    id: text("id").primaryKey(),
    patientId: text("patient_id")
      .notNull()
      .references(() => patients.id),
    staffId: text("staff_id")
      .notNull()
      .references(() => staff.id),
    startAt: text("start_at").notNull(),
    endAt: text("end_at").notNull(),
    status: text("status").notNull().default("scheduled"),
    reasonNote: text("reason_note"),
    createdBy: text("created_by").references(() => staff.id),
    deletedAt: text("deleted_at"),
    ...timestamps,
  },
  (t) => ({
    staffStartIdx: index("appointments_staff_start_idx").on(t.staffId, t.startAt),
    patientIdx: index("appointments_patient_idx").on(t.patientId),
  }),
);

export const treatmentRecords = sqliteTable(
  "treatment_records",
  {
    id: text("id").primaryKey(),
    patientId: text("patient_id")
      .notNull()
      .references(() => patients.id),
    appointmentId: text("appointment_id").references(() => appointments.id),
    toothNumber: text("tooth_number"),
    condition: text("condition"),
    procedure: text("procedure").notNull(),
    notes: text("notes"),
    prescription: text("prescription"),
    status: text("status").notNull().default("completed"),
    date: text("date").notNull(),
    staffId: text("staff_id")
      .notNull()
      .references(() => staff.id),
    deletedAt: text("deleted_at"),
    ...timestamps,
  },
  (t) => ({
    patientToothIdx: index("treatment_patient_tooth_idx").on(t.patientId, t.toothNumber),
    patientDateIdx: index("treatment_patient_date_idx").on(t.patientId, t.date),
  }),
);

export const invoices = sqliteTable(
  "invoices",
  {
    id: text("id").primaryKey(),
    patientId: text("patient_id")
      .notNull()
      .references(() => patients.id),
    status: text("status").notNull().default("unpaid"),
    date: text("date").notNull(),
    totalAmount: real("total_amount").notNull().default(0),
    amountPaid: real("amount_paid").notNull().default(0),
    notes: text("notes"),
    createdBy: text("created_by").references(() => staff.id),
    deletedAt: text("deleted_at"),
    ...timestamps,
  },
  (t) => ({
    patientIdx: index("invoices_patient_idx").on(t.patientId),
    statusIdx: index("invoices_status_idx").on(t.status),
  }),
);

export const invoiceItems = sqliteTable(
  "invoice_items",
  {
    id: text("id").primaryKey(),
    invoiceId: text("invoice_id")
      .notNull()
      .references(() => invoices.id),
    treatmentRecordId: text("treatment_record_id").references(() => treatmentRecords.id),
    description: text("description").notNull(),
    amount: real("amount").notNull(),
  },
  (t) => ({
    invoiceIdx: index("invoice_items_invoice_idx").on(t.invoiceId),
  }),
);

export const payments = sqliteTable(
  "payments",
  {
    id: text("id").primaryKey(),
    invoiceId: text("invoice_id")
      .notNull()
      .references(() => invoices.id),
    amount: real("amount").notNull(),
    method: text("method").notNull(),
    paidAt: text("paid_at").notNull(),
    note: text("note"),
    recordedBy: text("recorded_by")
      .notNull()
      .references(() => staff.id),
    createdAt: timestamps.createdAt,
  },
  (t) => ({
    invoiceIdx: index("payments_invoice_idx").on(t.invoiceId),
  }),
);

export const files = sqliteTable(
  "files",
  {
    id: text("id").primaryKey(),
    patientId: text("patient_id")
      .notNull()
      .references(() => patients.id),
    type: text("type").notNull(),
    fileName: text("file_name").notNull(),
    r2Key: text("r2_key").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    notes: text("notes"),
    uploadedBy: text("uploaded_by")
      .notNull()
      .references(() => staff.id),
    uploadedAt: text("uploaded_at").notNull(),
    deletedAt: text("deleted_at"),
    ...timestamps,
  },
  (t) => ({
    patientIdx: index("files_patient_idx").on(t.patientId),
    r2KeyUnique: uniqueIndex("files_r2_key_unique").on(t.r2Key),
  }),
);

export const reminders = sqliteTable(
  "reminders",
  {
    id: text("id").primaryKey(),
    appointmentId: text("appointment_id")
      .notNull()
      .references(() => appointments.id),
    patientId: text("patient_id")
      .notNull()
      .references(() => patients.id),
    channel: text("channel").notNull().default("whatsapp"),
    status: text("status").notNull().default("pending"),
    message: text("message").notNull(),
    scheduledFor: text("scheduled_for").notNull(),
    sentAt: text("sent_at"),
    sentBy: text("sent_by").references(() => staff.id),
    ...timestamps,
  },
  (t) => ({
    appointmentIdx: index("reminders_appointment_idx").on(t.appointmentId),
  }),
);
