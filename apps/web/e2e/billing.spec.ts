import { test, expect } from "@playwright/test";
import { loginAsDoctor, uniquePatient } from "./helpers.js";

// Critical path: creating an invoice and taking it from unpaid to fully paid.
test("creates an invoice and records payments through to paid", async ({ page }) => {
  await loginAsDoctor(page);
  const patient = uniquePatient("Billing Patient");

  await page.goto("/patients/new");
  await page.fill("#name", patient.name);
  await page.fill("#phone", patient.phone);
  await page.fill("#address", "123 Test Street");
  await page.fill("#medicalHistoryNotes", "None known.");
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/\/patients\/[a-f0-9-]+$/);
  const patientId = page.url().split("/").pop()!;

  await page.goto(`/billing/new?patientId=${patientId}`);
  const lineInputs = page.locator('input[placeholder^="Description"]');
  await lineInputs.first().fill("Scaling and polishing");
  await page.locator('input[placeholder="Amount"]').first().fill("1200");
  await page.getByRole("button", { name: "+ Add line" }).click();
  await lineInputs.nth(1).fill("Consultation");
  await page.locator('input[placeholder="Amount"]').nth(1).fill("300");
  await expect(page.getByText("₹1500.00")).toBeVisible();

  await page.getByRole("button", { name: "Create invoice" }).click();
  await expect(page).toHaveURL(/\/billing\/[a-f0-9-]+$/);
  await expect(page.getByRole("heading", { level: 1, name: /₹1500\.00/ })).toBeVisible();
  await expect(page.getByText("unpaid", { exact: true })).toBeVisible();

  await page.fill("#amount", "1500");
  await page.getByRole("button", { name: "Record" }).click();
  await expect(page.getByText("paid", { exact: true })).toBeVisible();
  await expect(page.getByText("₹1500.00 via cash")).toBeVisible();
});
