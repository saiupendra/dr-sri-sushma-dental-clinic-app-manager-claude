const API_URL = "http://localhost:8787";

export const E2E_DOCTOR = {
  username: "e2e_doctor",
  password: "e2e-test-password-1",
  name: "E2E Doctor",
};

/** Creates the first (doctor) account once, against the freshly migrated local D1 the webServer set up. */
export default async function globalSetup() {
  const status = await fetch(`${API_URL}/api/auth/bootstrap-status`).then((r) => r.json() as Promise<{ needsBootstrap: boolean }>);
  if (!status.needsBootstrap) return;

  const res = await fetch(`${API_URL}/api/auth/bootstrap`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(E2E_DOCTOR),
  });
  if (!res.ok) {
    throw new Error(`e2e global setup: bootstrap failed with ${res.status}: ${await res.text()}`);
  }
}
