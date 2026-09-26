import { test, expect } from "@playwright/test";
import { loginAsDoctor, uniquePatient } from "./helpers.js";

// Critical path: booking an appointment, and the clinic never double-books a slot.
test("books an appointment for a patient and blocks a conflicting double-booking", async ({ page }) => {
  await loginAsDoctor(page);
  const patient = uniquePatient("Booking Patient");

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

  await page.goto("/appointments/new");
  await page.fill('input[placeholder="Search by name or phone…"]', patient.name);
  await page.getByRole("button", { name: new RegExp(patient.name) }).click();
  await page.fill("#start", "2026-11-10T10:00");
  await page.fill("#duration", "30");
  await page.getByRole("button", { name: "Save appointment" }).click();
  await expect(page).toHaveURL(/\/appointments\/[a-f0-9-]+$/);
  await expect(page.getByText(patient.name)).toBeVisible();

  // Same slot again should be rejected as a conflict, not silently double-booked.
  await page.goto("/appointments/new");
  await page.fill('input[placeholder="Search by name or phone…"]', patient.name);
  await page.getByRole("button", { name: new RegExp(patient.name) }).click();
  await page.fill("#start", "2026-11-10T10:15");
  await page.fill("#duration", "30");
  await page.getByRole("button", { name: "Save appointment" }).click();
  await expect(page.getByText(/already has an appointment/i)).toBeVisible();

  await page.goto("/appointments");
  await page.fill('input[type="date"]', "2026-11-10");
  await expect(page.getByText(patient.name)).toBeVisible();
});

// Rescheduling (or a no-show/cancellation) offers to book the follow-up
// right away, and the original appointment then links to it.
test("rescheduling an appointment books a follow-up and links back to it", async ({ page }) => {
  await loginAsDoctor(page);
  const patient = uniquePatient("Reschedule Patient");

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

  await page.goto("/appointments/new");
  await page.fill('input[placeholder="Search by name or phone…"]', patient.name);
  await page.getByRole("button", { name: new RegExp(patient.name) }).click();
  await page.fill("#start", "2026-11-12T09:00");
  await page.fill("#duration", "30");
  await page.getByRole("button", { name: "Save appointment" }).click();
  await expect(page).toHaveURL(/\/appointments\/[a-f0-9-]+$/);
  const originalUrl = page.url();

  await page.getByRole("button", { name: "Edit" }).click();
  await page.selectOption("#status", "rescheduled");
  await page.getByRole("button", { name: "Save appointment" }).click();

  await expect(page.getByText(/Book a follow-up\?/)).toBeVisible();
  await page.fill("#followupStart", "2026-11-19T09:00");
  await page.getByRole("button", { name: "Save & book follow-up" }).click();

  await expect(page).toHaveURL(originalUrl);
  await expect(page.getByRole("link", { name: "View the booked follow-up appointment →" })).toBeVisible();
  await page.getByRole("link", { name: "View the booked follow-up appointment →" }).click();
  await expect(page).toHaveURL(/\/appointments\/[a-f0-9-]+$/);
  await expect(page).not.toHaveURL(originalUrl);
  await expect(page.getByText(patient.name)).toBeVisible();
  await expect(page.getByText("scheduled", { exact: true })).toBeVisible();
});
