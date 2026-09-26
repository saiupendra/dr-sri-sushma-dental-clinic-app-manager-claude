import path from "node:path";
import { fileURLToPath } from "node:url";
import { test, expect } from "@playwright/test";
import { loginAsDoctor, uniquePatient } from "./helpers.js";

const BEFORE_TREATMENT_PHOTO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "fixtures/before-treatment.png");

// Critical path: creating an invoice and taking it from unpaid to fully paid.
test("creates an invoice and records payments through to paid", async ({ page }) => {
  await loginAsDoctor(page);
  const patient = uniquePatient("Billing Patient");

  await page.goto("/patients/new");
  await page.fill("#name", patient.name);
  await page.fill("#phone", patient.phone);
  await page.fill("#address", "123 Test Street");
  await page.fill("#medicalHistoryNotes", "None known.");
  await page.fill("#consultationFee", "500");
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/\/patients\/[a-f0-9-]+$/);
  const patientId = page.url().split("/").pop()!;

  // Invoicing requires a completed treatment, so chart one first.
  await page.getByRole("button", { name: "Treatment notes" }).click();
  await page.getByRole("button", { name: "+ Add treatment note" }).click();
  await page.fill("#procedure", "Scaling and polishing");
  await page.selectOption("#condition", "healthy");
  await page.setInputFiles("#beforePhoto", BEFORE_TREATMENT_PHOTO);
  await page.getByRole("button", { name: "Save treatment note" }).click();
  await expect(page.getByText("Scaling and polishing")).toBeVisible();

  await page.goto(`/billing/new?patientId=${patientId}`);
  // Consultation fee (500, set on the patient above) is a fixed line the
  // server always adds - not something this form lets you type or remove.
  await page.getByRole("button", { name: "+ Add line" }).click();
  await page.locator('input[placeholder^="Description"]').fill("Scaling and polishing");
  await page.locator('input[placeholder="Amount"]').fill("1200");
  await expect(page.getByText("₹1700.00")).toBeVisible();

  await page.getByRole("button", { name: "Create invoice" }).click();
  await expect(page).toHaveURL(/\/billing\/[a-f0-9-]+$/);
  await expect(page.getByRole("heading", { level: 1, name: /₹1700\.00/ })).toBeVisible();
  await expect(page.getByText("unpaid", { exact: true })).toBeVisible();

  await page.fill("#amount", "1700");
  await page.getByRole("button", { name: "Record" }).click();
  await expect(page.getByText("paid", { exact: true })).toBeVisible();
  await expect(page.getByText("₹1700.00 via cash")).toBeVisible();
});
