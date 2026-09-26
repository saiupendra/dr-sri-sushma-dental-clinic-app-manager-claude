/**
 * Shared by both the API (server-built reminder messages) and the web app
 * (client-built "Send via WhatsApp" links for invoices) so phone-number
 * formatting can't drift between the two.
 */

/** Best-effort: most patient numbers on file are 10-digit Indian mobiles without a country code. */
export function toWhatsAppNumber(rawPhone: string): string {
  const digits = rawPhone.replace(/\D/g, "");
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 11 && digits.startsWith("0")) return `91${digits.slice(1)}`;
  return digits;
}

export function buildWhatsAppUrl(rawPhone: string, message: string): string {
  return `https://wa.me/${toWhatsAppNumber(rawPhone)}?text=${encodeURIComponent(message)}`;
}
