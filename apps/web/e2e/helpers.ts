import type { Page } from "@playwright/test";
import { E2E_DOCTOR } from "./global-setup.js";

export async function loginAsDoctor(page: Page): Promise<void> {
  await page.goto("/login");
  await page.fill("#username", E2E_DOCTOR.username);
  await page.fill("#password", E2E_DOCTOR.password);
  await page.click('button[type="submit"]');
  await page.waitForURL("/");
  // Wait for the authenticated shell itself, not just the URL, so later
  // full-page navigations don't race the /api/auth/me bootstrap on a fresh context.
  await page.getByText("Sign out").waitFor();
}

/** A collision-safe name/phone pair for test data, since specs share one D1. */
export function uniquePatient(label: string) {
  const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  return {
    name: `${label} ${suffix}`,
    phone: `9${suffix}`.slice(0, 10).padEnd(10, "0"),
  };
}
