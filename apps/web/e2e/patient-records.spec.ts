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
  await page.getByRole("button", { name: /^16$/ }).click();
  // Clicking a tooth lands on Treatment notes with the add-note form already
  // open and pre-filled with that tooth (it used to just switch tabs and
  // silently drop which tooth was clicked, leaving no way to tell it apart
  // from opening the form with nothing selected). The tooth is shown as a
  // locked display rather than a re-editable input, since it's already been
  // picked on the chart.
  await expect(page.locator("#tooth")).toContainText("16");
  await page.fill("#procedure", "Composite filling");
  await page.selectOption("#condition", "filled");
  await page.setInputFiles("#beforePhoto", BEFORE_TREATMENT_PHOTO);
  await page.getByRole("button", { name: "Save treatment note" }).click();
  await expect(page.getByText("Composite filling")).toBeVisible();

  await page.getByRole("button", { name: "Tooth chart" }).click();
  await expect(page.getByRole("button", { name: /^16$/ })).toHaveAttribute(
    "title",
    /Filled/,
  );

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
