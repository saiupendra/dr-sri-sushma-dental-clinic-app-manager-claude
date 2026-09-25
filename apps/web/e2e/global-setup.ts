const API_URL = "http://localhost:8787";

export const E2E_ADMIN = {
  username: "e2e_admin",
  password: "e2e-test-password-1",
  name: "E2E Admin",
};

export const E2E_DOCTOR = {
  username: "e2e_doctor",
  password: "e2e-test-password-2",
  name: "E2E Doctor",
};

/**
 * Bootstrap always creates an admin account now (see the ROLES comment in
 * constants.ts) - admin has no clinical access, so the specs that book
 * appointments, chart treatments or bill need an actual doctor account.
 * Runs once against the freshly migrated local D1 the webServer set up: log
 * in as the bootstrapped admin, then have it create that doctor account.
 */
export default async function globalSetup() {
  const status = await fetch(`${API_URL}/api/auth/bootstrap-status`).then((r) => r.json() as Promise<{ needsBootstrap: boolean }>);
  if (!status.needsBootstrap) return;

  const bootstrapRes = await fetch(`${API_URL}/api/auth/bootstrap`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(E2E_ADMIN),
  });
  if (!bootstrapRes.ok) {
    throw new Error(`e2e global setup: bootstrap failed with ${bootstrapRes.status}: ${await bootstrapRes.text()}`);
  }
  const setCookie = bootstrapRes.headers.get("set-cookie");
  if (!setCookie) {
    throw new Error("e2e global setup: bootstrap response carried no session cookie");
  }
  const sessionCookie = setCookie.split(";")[0];
  if (!sessionCookie) {
    throw new Error("e2e global setup: could not parse the session cookie");
  }

  const staffRes = await fetch(`${API_URL}/api/staff`, {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie: sessionCookie },
    body: JSON.stringify({ ...E2E_DOCTOR, role: "doctor" }),
  });
  if (!staffRes.ok) {
    throw new Error(`e2e global setup: creating the doctor account failed with ${staffRes.status}: ${await staffRes.text()}`);
  }
}
