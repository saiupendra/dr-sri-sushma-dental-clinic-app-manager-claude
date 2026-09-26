import path from "node:path";
import { fileURLToPath } from "node:url";
import { test, expect } from "@playwright/test";
import { loginAsDoctor, uniquePatient } from "./helpers.js";

// Just test image bytes - reused for both pre- and post-operative uploads,
// since the content itself is never asserted on.
const TEST_PHOTO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "fixtures/before-treatment.png");

/**
 * Creates a patient, charts one treatment note for them (always starts
 * "planned" - see TreatmentForm), then marks it completed via the
 * mandatory-evidence modal so it's eligible for invoicing. Returns the
 * patient's id and page URL.
 */
async function createPatientWithCompletedTreatment(
  page: import("@playwright/test").Page,
  namePrefix: string,
  procedure: string,
  condition: string,
  notes: string,
) {
  const patient = uniquePatient(namePrefix);

  await page.goto("/patients/new");
  await page.fill("#name", patient.name);
  await page.fill("#phone", patient.phone);
  await page.fill("#address", "123 Test Street");
  await page.fill("#medicalHistoryNotes", "None known.");
  await page.fill("#chiefComplaint", "Routine checkup.");
  await page.fill("#pastDentalHistory", "No prior treatment.");
  await page.fill("#medicationsUsing", "None.");
  await page.fill("#consultationFee", "500");
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/\/patients\/[a-f0-9-]+$/);
  const patientUrl = page.url();
  const patientId = patientUrl.split("/").pop()!;

  await page.getByRole("button", { name: "Treatment notes" }).click();
  await page.getByRole("button", { name: "+ Add treatment note" }).click();
  await page.fill("#procedure", procedure);
  await page.fill("#prescription", "None required.");
  await page.selectOption("#condition", condition);
  await page.fill("#notes", notes);
  await page.setInputFiles("#beforePhoto", TEST_PHOTO);
  await page.getByRole("button", { name: "Save treatment note" }).click();
  // No appointment was linked, so a planned note bounces to booking one.
  await expect(page).toHaveURL(/\/appointments\/new/);

  // Invoicing requires a *completed* treatment - mark this one completed.
  await page.goto(patientUrl);
  await page.getByRole("button", { name: "Treatment notes" }).click();
  await expect(page.getByText(procedure, { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Mark completed" }).click();
  await page.fill("#postTreatmentNotes", "Completed without complications.");
  await page.setInputFiles("#postPhotos", TEST_PHOTO);
  await page.getByRole("button", { name: "Save completion" }).click();
  await expect(page.getByText("completed", { exact: true })).toBeVisible();

  return { patientId, patientUrl };
}

// Critical path: creating an invoice and taking it from unpaid to fully paid.
test("creates an invoice and records payments through to paid", async ({ page }) => {
  await loginAsDoctor(page);
  const { patientId } = await createPatientWithCompletedTreatment(
    page,
    "Billing Patient",
    "Scaling and polishing",
    "healthy",
    "Routine scaling, no issues found.",
  );

  await page.goto(`/billing/new?patientId=${patientId}`);
  // Consultation fee (500, set on the patient above) is a fixed line the
  // server always adds - not something this form lets you type or remove.
  await page.getByRole("button", { name: "+ Add line" }).click();
  await page.locator('input[placeholder^="Description"]').fill("Scaling and polishing");
  await page.locator('input[placeholder="Cost"]').fill("1200");
  await page.getByLabel("Units").fill("2");
  await page.fill("#instructions", "Review after seven days.");
  await expect(page.getByText("₹2900.00")).toBeVisible();

  await page.getByRole("button", { name: "Create invoice" }).click();
  await expect(page).toHaveURL(/\/billing\/[a-f0-9-]+$/);
  await expect(page.getByRole("heading", { level: 1, name: /₹2900\.00/ })).toBeVisible();
  await expect(page.getByText("Review after seven days.")).toBeVisible();
  await expect(page.getByText("unpaid", { exact: true })).toBeVisible();

  await page.fill("#amount", "2900");
  await page.selectOption("#method", "amazon_pay");
  await page.getByRole("button", { name: "Record" }).click();
  await expect(page.getByText("paid", { exact: true })).toBeVisible();
  await expect(page.getByText("₹2900.00 via Amazon Pay")).toBeVisible();
});

// Covers a percentage discount and a cash discount applied together.
test("applies a combined percentage and cash discount when creating an invoice", async ({ page }) => {
  await loginAsDoctor(page);
  const { patientId } = await createPatientWithCompletedTreatment(
    page,
    "Discount Patient",
    "Root canal",
    "root_canal_treated",
    "First sitting completed, no complications.",
  );

  await page.goto(`/billing/new?patientId=${patientId}`);
  await page.getByRole("button", { name: "+ Add line" }).click();
  await page.locator('input[placeholder^="Description"]').fill("Root canal treatment");
  await page.locator('input[placeholder="Cost"]').fill("1500");
  await page.getByLabel("Units").fill("1");
  // Subtotal is 500 (consultation) + 1500 = 2000. 10% off (200) plus a
  // further ₹100 flat off combine to a ₹300 discount, for a ₹1700 total.
  await page.fill("#discountPercent", "10");
  await page.fill("#discountAmount", "100");
  await expect(page.getByText("₹1700.00")).toBeVisible();

  await page.getByRole("button", { name: "Create invoice" }).click();
  await expect(page).toHaveURL(/\/billing\/[a-f0-9-]+$/);
  await expect(page.getByRole("heading", { level: 1, name: /₹1700\.00/ })).toBeVisible();
  await expect(page.getByText("₹2000.00")).toBeVisible();
  await expect(page.getByText("- ₹300.00")).toBeVisible();
});
