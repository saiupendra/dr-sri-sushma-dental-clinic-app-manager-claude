import { CLINIC_NAME } from "@clinic/shared";

/** Best-effort: most patient numbers on file are 10-digit Indian mobiles without a country code. */
export function toWhatsAppNumber(rawPhone: string): string {
  const digits = rawPhone.replace(/\D/g, "");
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 11 && digits.startsWith("0")) return `91${digits.slice(1)}`;
  return digits;
}

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

export function buildWhatsAppUrl(rawPhone: string, message: string): string {
  return `https://wa.me/${toWhatsAppNumber(rawPhone)}?text=${encodeURIComponent(message)}`;
}
