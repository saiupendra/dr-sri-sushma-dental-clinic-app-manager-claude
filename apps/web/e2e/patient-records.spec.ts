import path from "node:path";
import { fileURLToPath } from "node:url";
import { test, expect } from "@playwright/test";
import { loginAsAdmin, loginAsDoctor, signOut, uniquePatient } from "./helpers.js";

const BEFORE_TREATMENT_PHOTO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "fixtures/before-treatment.png");

async function fillNewPatientForm(page: import("@playwright/test").Page, name: string, phone: string, medicalHistoryNotes: string) {
  await page.goto("/patients/new");
  await page.fill("#name", name);
  await page.fill("#phone", phone);
  await page.fill("#address", "123 Test Street");
  await page.fill("#medicalHistoryNotes", medicalHistoryNotes);
  await page.fill("#chiefComplaint", "Routine checkup.");
  await page.fill("#pastDentalHistory", "No prior treatment.");
  await page.fill("#medicationsUsing", "None.");
  await page.fill("#consultationFee", "500");
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/\/patients\/[a-f0-9-]+$/);
}

// Critical path: a patient's record (demographics, treatment notes, tooth
// chart) is entered once and stays accessible — including a re-visit while
// offline, which is the clinic's explicit reliability requirement.
test("records patient details and a treatment note, and stays readable offline", async ({ page, context }) => {
  await loginAsDoctor(page);
  const patient = uniquePatient("Records Patient");

  await fillNewPatientForm(page, patient.name, patient.phone, "Allergic to penicillin.");
  const patientUrl = page.url();

  await expect(page.getByText("Allergic to penicillin.")).toBeVisible();

  await page.getByRole("button", { name: "Tooth chart" }).click();
  // Tapping a tooth only selects it (multiple teeth can be picked for one
  // sitting) - Next is what actually moves on to Treatment notes.
  await page.getByRole("button", { name: /^16$/ }).click();
  await page.getByRole("button", { name: /^Next/ }).click();
  // Landing on Treatment notes opens the add-note form already, pre-filled
  // with the tooth/teeth picked on the chart - each tooth gets its own
  // condition/notes/photo row, shown as a locked badge rather than a
  // re-editable input, since it's already been picked on the chart.
  await expect(page.getByText("Tooth 16", { exact: true })).toBeVisible();
  await page.fill("#procedure", "Composite filling");
  await page.fill("#prescription", "Ibuprofen 400mg if needed.");
  await page.selectOption("#condition-16", "filled");
  await page.fill("#notes-16", "Cavity cleaned and filled.");
  await page.setInputFiles("#beforePhoto-16", BEFORE_TREATMENT_PHOTO);
  await page.getByRole("button", { name: "Save treatment note" }).click();
  // A newly-saved planned note with no linked appointment bounces to booking one.
  await expect(page).toHaveURL(/\/appointments\/new/);
  await page.goto(patientUrl);
  await page.getByRole("button", { name: "Treatment notes" }).click();
  await expect(page.getByText("Composite filling")).toBeVisible();

  await page.getByRole("button", { name: "Tooth chart" }).click();
  await expect(page.getByRole("button", { name: /^16$/ })).toHaveAttribute(
    "title",
    /Filled/,
  );

  // Selecting several teeth before Next creates one treatment note per
  // tooth, each with its own condition/notes/photo, sharing only the
  // procedure and prescription entered once for the whole visit.
  await page.getByRole("button", { name: /^11$/ }).click();
  await page.getByRole("button", { name: /^12$/ }).click();
  await page.getByRole("button", { name: /^Next/ }).click();
  await expect(page.getByText("Tooth 11", { exact: true })).toBeVisible();
  await expect(page.getByText("Tooth 12", { exact: true })).toBeVisible();
  await page.fill("#procedure", "Scaling");
  await page.fill("#prescription", "None required.");
  // Exercises the new "Others" condition, which requires manual entry - and
  // that each tooth's condition/notes are independent of the other's.
  await page.selectOption("#condition-11", "other");
  await page.fill("#conditionOther-11", "Mild staining");
  await page.fill("#notes-11", "Light staining removed.");
  await page.setInputFiles("#beforePhoto-11", BEFORE_TREATMENT_PHOTO);
  await page.selectOption("#condition-12", "healthy");
  await page.fill("#notes-12", "No issues found.");
  await page.setInputFiles("#beforePhoto-12", BEFORE_TREATMENT_PHOTO);
  await page.getByRole("button", { name: "Save treatment note for 2 teeth" }).click();
  await expect(page).toHaveURL(/\/appointments\/new/);
  await page.goto(patientUrl);
  await page.getByRole("button", { name: "Treatment notes" }).click();
  await expect(page.getByText("Other — Mild staining")).toBeVisible();

  await page.getByRole("button", { name: "Tooth chart" }).click();
  await expect(page.getByRole("button", { name: /^11$/ })).toHaveAttribute("title", /Other — Mild staining/);
  await expect(page.getByRole("button", { name: /^12$/ })).toHaveAttribute("title", /Healthy/);

  // Now go offline and revisit the same patient via client-side navigation
  // (nav-link clicks, never a full page reload — that would drop the
  // in-memory query cache and depend on IndexedDB persistence timing
  // instead). The earlier view already cached this patient in-memory, so
  // this proves the real, everyday guarantee: an SPA transition needs no
  // network round trip once the patient has already been viewed this session.
  await page.getByRole("link", { name: "Patients" }).click();
  await expect(page).toHaveURL(/\/patients$/);
  await expect(page.getByText(patient.name)).toBeVisible();
  await context.setOffline(true);
  await page.getByText(patient.name).click();
  await expect(page).toHaveURL(patientUrl);
  await expect(page.getByText("Allergic to penicillin.")).toBeVisible();
  await context.setOffline(false);
});

// Covers the "planned by default, mandatory prescription/notes, and linked
// to a booked appointment" treatment-note behavior together, since they're
// one connected flow in the form.
test("defaults a treatment note to planned, requires a prescription and notes, and links it to an existing appointment", async ({ page }) => {
  await loginAsDoctor(page);
  const patient = uniquePatient("Planned Treatment Patient");

  await fillNewPatientForm(page, patient.name, patient.phone, "None known.");
  const patientUrl = page.url();

  await page.goto("/appointments/new");
  await page.fill('input[placeholder="Search by name or phone…"]', patient.name);
  await page.getByRole("button", { name: new RegExp(patient.name) }).click();
  await page.fill("#start", "2026-12-05T10:00");
  await page.fill("#duration", "30");
  await page.getByRole("button", { name: "Save appointment" }).click();
  await expect(page).toHaveURL(/\/appointments\/[a-f0-9-]+$/);

  await page.goto(patientUrl);
  await page.getByRole("button", { name: "Tooth chart" }).click();
  await page.getByRole("button", { name: /^24$/ }).click();
  await page.getByRole("button", { name: /^Next/ }).click();

  await page.fill("#procedure", "Crown fitting");
  await page.selectOption("#condition-24", "crown");
  await page.setInputFiles("#beforePhoto-24", BEFORE_TREATMENT_PHOTO);
  await page.getByRole("button", { name: "Save treatment note" }).click();
  await expect(page.getByText("Add a prescription.")).toBeVisible();

  await page.fill("#prescription", "None required yet.");
  await page.getByRole("button", { name: "Save treatment note" }).click();
  await expect(page.getByText("Add notes for every tooth.")).toBeVisible();

  await page.fill("#notes-24", "Prep done, crown ordered from the lab.");
  // Only one appointment exists for this patient - pick it by position
  // rather than its exact label text (date/time formatting is incidental).
  const appointmentValue = await page.locator("#appointment option").nth(1).getAttribute("value");
  await page.selectOption("#appointment", appointmentValue!);

  await page.getByRole("button", { name: "Save treatment note" }).click();
  // Already linked to a booked appointment, so this must NOT bounce to
  // /appointments/new the way an unlinked planned note would.
  await expect(page).toHaveURL(patientUrl);
  await expect(page.getByText("Crown fitting")).toBeVisible();
});

// Deleting a saved treatment note is admin-only - a doctor (who authors
// them) can no longer remove one once saved. See the RBAC table in
// docs/architecture.md.
test("only admin can delete a saved treatment note", async ({ page }) => {
  await loginAsDoctor(page);
  const patient = uniquePatient("Delete RBAC Patient");

  await fillNewPatientForm(page, patient.name, patient.phone, "None known.");
  const patientUrl = page.url();

  await page.getByRole("button", { name: "Treatment notes" }).click();
  await page.getByRole("button", { name: "+ Add treatment note" }).click();
  await page.fill("#procedure", "Extraction");
  await page.fill("#prescription", "None required yet.");
  await page.selectOption("#condition", "extraction_planned");
  await page.fill("#notes", "Wisdom tooth extraction discussed.");
  await page.setInputFiles("#beforePhoto", BEFORE_TREATMENT_PHOTO);
  await page.getByRole("button", { name: "Save treatment note" }).click();
  // Unlinked planned note - bounces to booking an appointment.
  await expect(page).toHaveURL(/\/appointments\/new/);

  await page.goto(patientUrl);
  await page.getByRole("button", { name: "Treatment notes" }).click();
  await expect(page.getByText("Extraction", { exact: true })).toBeVisible();

  // The doctor who just authored it has no Delete button at all.
  await expect(page.getByRole("button", { name: "Delete" })).toHaveCount(0);

  await signOut(page);
  await loginAsAdmin(page);
  await page.goto(patientUrl);
  await page.getByRole("button", { name: "Treatment notes" }).click();
  await expect(page.getByText("Extraction", { exact: true })).toBeVisible();

  page.once("dialog", (dialog) => void dialog.accept());
  await page.getByRole("button", { name: "Delete" }).click();
  await expect(page.getByText("Extraction", { exact: true })).not.toBeVisible();
});

// Completing is a one-way move that requires evidence (post-op photos,
// notes and the done date) and can never be reverted back to planned - see
// the requireRole/route guard in PATCH /api/treatments/:id/complete.
test("marking a treatment note completed requires post-op evidence and cannot be reverted", async ({ page }) => {
  await loginAsDoctor(page);
  const patient = uniquePatient("Completion Patient");

  await fillNewPatientForm(page, patient.name, patient.phone, "None known.");
  const patientUrl = page.url();

  await page.getByRole("button", { name: "Treatment notes" }).click();
  await page.getByRole("button", { name: "+ Add treatment note" }).click();
  await page.fill("#procedure", "Filling");
  await page.fill("#prescription", "None required.");
  await page.selectOption("#condition", "decayed");
  await page.fill("#notes", "Cavity found, filling planned.");
  await page.setInputFiles("#beforePhoto", BEFORE_TREATMENT_PHOTO);
  await page.getByRole("button", { name: "Save treatment note" }).click();
  await expect(page).toHaveURL(/\/appointments\/new/);

  await page.goto(patientUrl);
  await page.getByRole("button", { name: "Treatment notes" }).click();
  await expect(page.getByText("planned", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Mark completed" }).click();
  await page.getByRole("button", { name: "Save completion" }).click();
  await expect(page.getByText("Add post-operative notes.")).toBeVisible();

  await page.fill("#postTreatmentNotes", "Filled without complications.");
  await page.getByRole("button", { name: "Save completion" }).click();
  await expect(page.getByText("Add at least one post-operative photo.")).toBeVisible();

  await page.setInputFiles("#postPhotos", BEFORE_TREATMENT_PHOTO);
  await page.getByRole("button", { name: "Save completion" }).click();
  await expect(page.getByText("completed", { exact: true })).toBeVisible();

  // No way back to planned - the toggle button is simply gone.
  await expect(page.getByRole("button", { name: "Mark completed" })).toHaveCount(0);
  await expect(page.getByText("Filled without complications.")).toBeVisible();
});
