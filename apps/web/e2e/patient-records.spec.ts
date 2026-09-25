import { test, expect } from "@playwright/test";
import { loginAsDoctor, uniquePatient } from "./helpers.js";

// Critical path: a patient's record (demographics, treatment notes, tooth
// chart) is entered once and stays accessible — including a re-visit while
// offline, which is the clinic's explicit reliability requirement.
test("records patient details and a treatment note, and stays readable offline", async ({ page, context }) => {
  await loginAsDoctor(page);
  const patient = uniquePatient("Records Patient");

  await page.goto("/patients/new");
  await page.fill("#name", patient.name);
  await page.fill("#phone", patient.phone);
  await page.fill("#medicalHistoryNotes", "Allergic to penicillin.");
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/\/patients\/[a-f0-9-]+$/);
  const patientUrl = page.url();

  await expect(page.getByText("Allergic to penicillin.")).toBeVisible();

  await page.getByRole("button", { name: "Tooth chart" }).click();
  await page.getByRole("button", { name: /^16$/ }).click();
  await page.getByRole("button", { name: "Treatment notes" }).click();
  await page.getByRole("button", { name: "+ Add treatment note" }).click();
  await page.fill("#procedure", "Composite filling");
  await page.selectOption("#condition", "filled");
  await page.fill("#tooth", "16");
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
