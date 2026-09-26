import path from "node:path";
import { fileURLToPath } from "node:url";
import { test, expect } from "@playwright/test";
import { loginAsDoctor, uniquePatient } from "./helpers.js";

const BEFORE_TREATMENT_PHOTO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "fixtures/before-treatment.png");

// Critical path: a patient's record (demographics, treatment notes, tooth
// chart) is entered once and stays accessible — including a re-visit while
// offline, which is the clinic's explicit reliability requirement.
test("records patient details and a treatment note, and stays readable offline", async ({ page, context }) => {
  await loginAsDoctor(page);
  const patient = uniquePatient("Records Patient");

  await page.goto("/patients/new");
  await page.fill("#name", patient.name);
  await page.fill("#phone", patient.phone);
  await page.fill("#address", "123 Test Street");
  await page.fill("#medicalHistoryNotes", "Allergic to penicillin.");
  await page.fill("#consultationFee", "500");
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/\/patients\/[a-f0-9-]+$/);
  const patientUrl = page.url();

  await expect(page.getByText("Allergic to penicillin.")).toBeVisible();

  await page.getByRole("button", { name: "Tooth chart" }).click();
  // Tapping a tooth only selects it (multiple teeth can be picked for one
  // sitting) - Next is what actually moves on to Treatment notes.
  await page.getByRole("button", { name: /^16$/ }).click();
  await page.getByRole("button", { name: /^Next/ }).click();
  // Landing on Treatment notes opens the add-note form already, pre-filled
  // with the tooth/teeth picked on the chart (it used to just switch tabs
  // and silently drop which tooth was clicked, leaving no way to tell it
  // apart from opening the form with nothing selected). The tooth is shown
  // as a locked display rather than a re-editable input, since it's already
  // been picked on the chart.
  await expect(page.locator("#tooth")).toContainText("16");
  await page.fill("#procedure", "Composite filling");
  await page.selectOption("#condition", "filled");
  await page.fill("#notes", "Cavity cleaned and filled.");
  await page.fill("#prescription", "Ibuprofen 400mg if needed.");
  // The work already happened this visit, so mark it completed rather than
  // leaving the new default (planned) - planned would bounce to scheduling.
  await page.selectOption("#status", "completed");
  await page.setInputFiles("#beforePhoto-16", BEFORE_TREATMENT_PHOTO);
  await page.getByRole("button", { name: "Save treatment note" }).click();
  await expect(page.getByText("Composite filling")).toBeVisible();

  await page.getByRole("button", { name: "Tooth chart" }).click();
  await expect(page.getByRole("button", { name: /^16$/ })).toHaveAttribute(
    "title",
    /Filled/,
  );

  // Selecting several teeth before Next creates one treatment note per
  // tooth, all sharing the same procedure/condition/photo from one form.
  await page.getByRole("button", { name: /^11$/ }).click();
  await page.getByRole("button", { name: /^12$/ }).click();
  await page.getByRole("button", { name: /^Next/ }).click();
  await expect(page.locator("#tooth")).toContainText("11");
  await expect(page.locator("#tooth")).toContainText("12");
  await page.fill("#procedure", "Scaling");
  // Exercises the new "Others" condition, which requires manual entry.
  await page.selectOption("#condition", "other");
  await page.fill("#conditionOther", "Mild staining");
  await page.fill("#notes", "Light staining removed from both teeth.");
  await page.fill("#prescription", "None required.");
  await page.selectOption("#status", "completed");
  // Multi-tooth selection needs its own before-treatment photo per tooth.
  await page.setInputFiles("#beforePhoto-11", BEFORE_TREATMENT_PHOTO);
  await page.setInputFiles("#beforePhoto-12", BEFORE_TREATMENT_PHOTO);
  await page.getByRole("button", { name: "Save treatment note for 2 teeth" }).click();
  await expect(page.getByText("Other — Mild staining").first()).toBeVisible();

  await page.getByRole("button", { name: "Tooth chart" }).click();
  await expect(page.getByRole("button", { name: /^11$/ })).toHaveAttribute("title", /Other — Mild staining/);
  await expect(page.getByRole("button", { name: /^12$/ })).toHaveAttribute("title", /Other — Mild staining/);

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

// Covers the "planned by default, mandatory notes/prescription, and mapped
// to a booked appointment" treatment-note behavior together, since they're
// one connected flow in the form.
test("defaults a treatment note to planned, requires notes and a prescription, and maps it to a linked appointment", async ({ page }) => {
  await loginAsDoctor(page);
  const patient = uniquePatient("Planned Treatment Patient");

  await page.goto("/patients/new");
  await page.fill("#name", patient.name);
  await page.fill("#phone", patient.phone);
  await page.fill("#address", "123 Test Street");
  await page.fill("#medicalHistoryNotes", "None known.");
  await page.fill("#consultationFee", "500");
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/\/patients\/[a-f0-9-]+$/);
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
  await page.selectOption("#condition", "crown");
  // Confirm the new default before touching it - nothing here changes status.
  await expect(page.locator("#status")).toHaveValue("planned");

  await page.setInputFiles("#beforePhoto-24", BEFORE_TREATMENT_PHOTO);
  await page.getByRole("button", { name: "Save treatment note" }).click();
  await expect(page.getByText("Add treatment notes.")).toBeVisible();

  await page.fill("#notes", "Prep done, crown ordered from the lab.");
  await page.getByRole("button", { name: "Save treatment note" }).click();
  await expect(page.getByText("Add a prescription.")).toBeVisible();

  await page.fill("#prescription", "None required yet.");
  // Only one appointment exists for this patient - pick it by position
  // rather than its exact label text (date/time formatting is incidental).
  const appointmentValue = await page.locator("#appointment option").nth(1).getAttribute("value");
  await page.selectOption("#appointment", appointmentValue!);
  // Linking the appointment pulls the note's date onto the appointment's date.
  await expect(page.locator("#date")).toHaveValue("2026-12-05");

  await page.getByRole("button", { name: "Save treatment note" }).click();
  // Already linked to a booked appointment, so this must NOT bounce to
  // /appointments/new the way an unlinked planned note would.
  await expect(page).toHaveURL(patientUrl);
  await expect(page.getByText("Crown fitting")).toBeVisible();
});
