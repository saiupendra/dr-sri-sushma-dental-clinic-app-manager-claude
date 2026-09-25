import { CLINIC_NAME } from "@clinic/shared";

/** Best-effort: most patient numbers on file are 10-digit Indian mobiles without a country code. */
export function toWhatsAppNumber(rawPhone: string): string {
  const digits = rawPhone.replace(/\D/g, "");
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 11 && digits.startsWith("0")) return `91${digits.slice(1)}`;
  return digits;
}

export function defaultReminderMessage(patientName: string, startAtIso: string): string {
  const dt = new Date(startAtIso);
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
  return `Hi ${patientName}, this is a reminder from ${CLINIC_NAME} for your appointment on ${date} at ${time}. Reply here or call us if you need to reschedule.`;
}

export function buildWhatsAppUrl(rawPhone: string, message: string): string {
  return `https://wa.me/${toWhatsAppNumber(rawPhone)}?text=${encodeURIComponent(message)}`;
}
