import { sql } from "drizzle-orm";
import { type AnySQLiteColumn, index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

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
    // Soft-delete only - appointments, treatment_records, invoices, payments
    // and files all carry a required staff.id reference, so a real DELETE
    // would either violate that foreign key or (if unenforced) silently
    // orphan historical records. See routes/staff.ts.
    deletedAt: text("deleted_at"),
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
    // Nullable, no default: D1 (real Cloudflare D1, unlike the local/Miniflare
    // simulation) rejects `ALTER TABLE ADD COLUMN` with a non-constant default
    // ("Cannot add a column with non-constant default") - a restriction that
    // only surfaced against the real remote database, not local dev. Always
    // set explicitly by createSession()/verifySession() in lib/session.ts, so
    // it's never actually null once a session is created or used.
    lastUsedAt: text("last_used_at"),
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
    // All three nullable at the DB level only because D1 rejects a
    // non-constant ALTER TABLE default (see the sessions.last_used_at
    // comment above) - createPatientSchema is what actually requires them
    // non-empty for every new patient, same pattern as address/medicalHistoryNotes.
    chiefComplaint: text("chief_complaint"),
    pastDentalHistory: text("past_dental_history"),
    medicationsUsing: text("medications_using"),
    heightFeet: real("height_feet"),
    weightKg: real("weight_kg"),
    bloodPressure: text("blood_pressure"),
    bloodSugar: text("blood_sugar"),
    consultationFee: real("consultation_fee"),
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
    // Set when this appointment was rescheduled/no-showed/cancelled and a
    // follow-up was booked from that popup (see routes/appointments.ts) -
    // points at the new appointment row. Self-referencing, so the FK target
    // is wrapped in a lazy callback (this table isn't fully defined yet at
    // this point in its own initializer).
    rescheduledToAppointmentId: text("rescheduled_to_appointment_id").references(
      (): AnySQLiteColumn => appointments.id,
    ),
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
    // Free-text description when condition is "other"; null otherwise.
    conditionOther: text("condition_other"),
    procedure: text("procedure").notNull(),
    notes: text("notes"),
    prescription: text("prescription"),
    status: text("status").notNull().default("completed"),
    // Set server-side at creation (today), never client-supplied.
    date: text("date").notNull(),
    // Set only once, by PATCH /:id/complete - the date the work was
    // actually done, mandatory at completion. Null while still planned.
    completedDate: text("completed_date"),
    postTreatmentNotes: text("post_treatment_notes"),
    staffId: text("staff_id")
      .notNull()
      .references(() => staff.id),
    // Deprecated: superseded by beforeTreatmentFileIds (plural, JSON array)
    // below, which supports multiple photos per tooth. Left in place,
    // unused by the app, only so rows saved before that migration keep
    // their original single photo on record.
    beforeTreatmentFileId: text("before_treatment_file_id").references(() => files.id),
    // JSON-encoded array of files.id (see lib/treatmentFiles.ts). A join
    // table would be the "proper" normalized shape, but these are only ever
    // read/written alongside their one treatment record, never queried
    // independently, so a JSON array avoids the extra table and joins for
    // no real benefit at this app's scale.
    beforeTreatmentFileIds: text("before_treatment_file_ids"),
    afterTreatmentFileIds: text("after_treatment_file_ids"),
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
    // Raw inputs behind totalAmount's discount - see routes/invoices.ts.
    discountPercent: real("discount_percent").notNull().default(0),
    discountAmount: real("discount_amount").notNull().default(0),
    notes: text("notes"),
    createdBy: text("created_by").references(() => staff.id),
    deletedAt: text("deleted_at"),
    // Unguessable, set at creation (see POST /api/invoices) - lets a patient
    // open their own invoice's PDF from a WhatsApp link with no login, since
    // this app has no patient-facing auth at all. Nullable only because D1
    // rejects a non-constant ALTER TABLE default; the migration backfills it
    // for rows that predate this column.
    shareToken: text("share_token"),
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
    units: integer("units").notNull().default(1),
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
