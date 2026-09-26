import { CLINIC_NAME } from "@clinic/shared";

// toWhatsAppNumber/buildWhatsAppUrl now live in @clinic/shared, since the web
// app's invoice "Send via WhatsApp" button needs the exact same phone-number
// formatting - re-exported here so nothing else in this file's callers had
// to change import paths.
export { toWhatsAppNumber, buildWhatsAppUrl } from "@clinic/shared";

/** e.g. "5 October 2026 at 4:30 PM", in the clinic's own timezone regardless of server/runtime locale. */
export function formatIstDateTime(iso: string): string {
  const dt = new Date(iso);
  const date = dt.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });
  const time = dt.toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  });
  return `${date} at ${time}`;
}

export function defaultReminderMessage(patientName: string, startAtIso: string): string {
  return `Hi ${patientName}, this is a reminder from ${CLINIC_NAME} for your appointment on ${formatIstDateTime(startAtIso)}. Reply here or call us if you need to reschedule.`;
}
