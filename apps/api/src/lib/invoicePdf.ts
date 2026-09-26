import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage } from "pdf-lib";
import {
  CLINIC_ADDRESS,
  CLINIC_EMAIL,
  CLINIC_GSTIN,
  CLINIC_HOURS,
  CLINIC_NAME,
  CLINIC_PHONE,
  CLINIC_WEBSITE,
} from "@clinic/shared";
import { CLINIC_LOGO_PNG_BASE64 } from "../assets/clinicLogo.js";

const PAGE_WIDTH = 595.28; // A4, points
const PAGE_HEIGHT = 841.89;
const MARGIN = 48;
const LOGO_SIZE = 64;
const BRAND_BLUE = rgb(0.29, 0.45, 0.75); // sampled from the real clinic logo
const DARK = rgb(0.13, 0.15, 0.18);
const GRAY = rgb(0.45, 0.47, 0.5);
const LIGHT_LINE = rgb(0.85, 0.86, 0.88);
const GREEN = rgb(0.1, 0.55, 0.3);
const AMBER = rgb(0.75, 0.5, 0.05);

export interface InvoicePdfItem {
  description: string;
  amount: number;
  units?: number;
}

export interface InvoicePdfPayment {
  amount: number;
  method: string;
  note?: string | null;
}

export interface InvoicePdfInput {
  invoiceId: string;
  date: string; // ISO
  status: string;
  patientName: string;
  patientPhone: string;
  items: InvoicePdfItem[];
  /** Sum of item amounts before any discount; omitted (legacy callers/tests) is treated as equal to totalAmount. */
  subtotal?: number;
  discountPercent?: number;
  discountAmount?: number;
  totalAmount: number;
  amountPaid: number;
  payments?: InvoicePdfPayment[];
  instructions?: string | null;
  /** Name of the staff account that created the invoice; omitted (legacy rows, or a deleted account) leaves the footer credit off. */
  generatedByName?: string | null;
  /** Doctor(s) who performed the billed treatment(s), resolved from the line items' linked treatment records. Empty when no item is tied to one (e.g. a standalone consultation fee). */
  treatedByNames?: string[];
}

/**
 * pdf-lib's standard fonts use WinAnsi encoding, which has no glyph for "₹"
 * (Rupee sign) - drawText would throw. "Rs." is the safe, universally
 * understood substitute rather than embedding a whole custom Unicode font
 * just for one symbol.
 */
function formatMoney(amount: number): string {
  return `Rs. ${amount.toFixed(2)}`;
}

function formatCellAmount(amount: number): string {
  return amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const SMALL_NUMBERS = ["Zero", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function numberWords(value: number): string {
  if (value < 20) return SMALL_NUMBERS[value]!;
  if (value < 100) return `${TENS[Math.floor(value / 10)]}${value % 10 ? ` ${numberWords(value % 10)}` : ""}`;
  if (value < 1000) return `${numberWords(Math.floor(value / 100))} Hundred${value % 100 ? ` ${numberWords(value % 100)}` : ""}`;
  for (const [size, label] of [[10000000, "Crore"], [100000, "Lakh"], [1000, "Thousand"]] as const) {
    if (value >= size) return `${numberWords(Math.floor(value / size))} ${label}${value % size ? ` ${numberWords(value % size)}` : ""}`;
  }
  return "Zero";
}

export function amountInWords(amount: number): string {
  const paise = Math.round(amount * 100);
  const rupees = Math.floor(paise / 100);
  const fraction = paise % 100;
  return `${numberWords(rupees)} Indian Rupees${fraction ? ` and ${numberWords(fraction)} Paise` : ""} Only`;
}

function paymentLabel(method: string, note?: string | null): string {
  const labels: Record<string, string> = { cash: "Cash", card: "Card", upi: "UPI", amazon_pay: "Amazon Pay", netbanking: "Net banking" };
  return labels[method] ?? (method === "other" && note ? note : "Other");
}

function shortInvoiceNumber(invoiceId: string): string {
  return `INV-${invoiceId.replace(/-/g, "").slice(0, 8).toUpperCase()}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });
}

function statusLabel(status: string): { text: string; color: ReturnType<typeof rgb> } {
  if (status === "paid") return { text: "PAID", color: GREEN };
  if (status === "cancelled") return { text: "CANCELLED", color: GRAY };
  if (status === "partially_paid") return { text: "PARTIALLY PAID", color: AMBER };
  return { text: "UNPAID", color: AMBER };
}

/**
 * Where the full-width clinic detail lines and the divider sit, in points
 * below the top margin. Kept below HEADER_TOP_ZONE_BOTTOM (where the
 * invoice #/date/status column finishes) so a long line here - the address
 * is 80+ characters - can never run into that right-aligned text, whatever
 * its exact rendered width turns out to be.
 */
const HEADER_TOP_ZONE_BOTTOM = 44;
const ADDRESS_Y = 62;
const CONTACT_Y = 94;
const WEBSITE_Y = 108;
const GSTIN_Y = 122;
const DIVIDER_Y = 140;

/** Renders the fixed page furniture (logo, letterhead, footer) that every page of a multi-page invoice repeats. */
function drawPageChrome(
  page: PDFPage,
  logo: Awaited<ReturnType<PDFDocument["embedPng"]>>,
  fontBold: PDFFont,
  font: PDFFont,
  generatedByName?: string | null,
) {
  const top = PAGE_HEIGHT - MARGIN;
  const textX = MARGIN + LOGO_SIZE + 14;
  page.drawImage(logo, { x: MARGIN, y: top - LOGO_SIZE + 8, width: LOGO_SIZE, height: LOGO_SIZE });
  // Helvetica is one of the 14 standard PDF fonts, so it renders consistently
  // in every viewer with no embedding needed (same reason Courier was used
  // before) - proportional spacing just reads cleaner than a monospace face
  // for a letterhead. Keep the clinic name compact enough to clear the
  // invoice number regardless.
  page.drawText(CLINIC_NAME, { x: textX, y: top - 8, size: 10.5, font: fontBold, color: DARK });

  // Full-width from here down - see HEADER_TOP_ZONE_BOTTOM above.
  const [addressFirst, addressSecond] = CLINIC_ADDRESS.split(", Hyderabad, ");
  page.drawText(addressFirst!, { x: textX, y: top - ADDRESS_Y, size: 8.5, font, color: GRAY });
  page.drawText(`Hyderabad, ${addressSecond}`, { x: textX, y: top - ADDRESS_Y - 14, size: 8.5, font, color: GRAY });
  page.drawText(`Phone: ${CLINIC_PHONE}   |   Email: ${CLINIC_EMAIL}`, { x: textX, y: top - CONTACT_Y, size: 8.5, font, color: GRAY });
  page.drawText(`${CLINIC_WEBSITE}   |   Timings: ${CLINIC_HOURS}`, { x: textX, y: top - WEBSITE_Y, size: 8.5, font, color: GRAY });
  page.drawText(`GSTIN: ${CLINIC_GSTIN}`, { x: textX, y: top - GSTIN_Y, size: 8.5, font, color: GRAY });

  if (generatedByName) {
    page.drawText(`Invoice generated by ${generatedByName}`, {
      x: MARGIN,
      y: MARGIN + 12,
      size: 7.5,
      font,
      color: GRAY,
    });
  }
  page.drawText("Thank you for visiting Dr.Sri Sushma Multispeciality Dental Clinic.", {
    x: MARGIN,
    y: MARGIN,
    size: 7.5,
    font,
    color: GRAY,
  });
  page.drawText("This is a system-generated invoice and does not require a signature.", {
    x: MARGIN,
    y: MARGIN - 12,
    size: 7.5,
    font,
    color: GRAY,
  });
}

export async function generateInvoicePdf(input: InvoicePdfInput): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const logoBytes = Uint8Array.from(atob(CLINIC_LOGO_PNG_BASE64), (c) => c.charCodeAt(0));
  const logo = await pdfDoc.embedPng(logoBytes);

  let page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  drawPageChrome(page, logo, fontBold, font, input.generatedByName);

  const rightColX = PAGE_WIDTH - MARGIN;
  const top = PAGE_HEIGHT - MARGIN;
  const invoiceNo = shortInvoiceNumber(input.invoiceId);
  const invoiceNoWidth = fontBold.widthOfTextAtSize(invoiceNo, 15);
  page.drawText(invoiceNo, { x: rightColX - invoiceNoWidth, y: top - 10, size: 15, font: fontBold, color: BRAND_BLUE });
  const dateText = formatDate(input.date);
  const dateWidth = font.widthOfTextAtSize(dateText, 10);
  page.drawText(dateText, { x: rightColX - dateWidth, y: top - 26, size: 10, font, color: GRAY });
  const { text: statusText, color: statusColor } = statusLabel(input.status);
  const statusWidth = fontBold.widthOfTextAtSize(statusText, 10);
  page.drawText(statusText, { x: rightColX - statusWidth, y: top - HEADER_TOP_ZONE_BOTTOM, size: 10, font: fontBold, color: statusColor });

  let y = top - DIVIDER_Y;
  page.drawLine({ start: { x: MARGIN, y }, end: { x: rightColX, y }, thickness: 1, color: LIGHT_LINE });
  y -= 24;

  const treatedByX = MARGIN + 280;
  const hasTreatedBy = !!input.treatedByNames && input.treatedByNames.length > 0;
  page.drawText("BILLED TO", { x: MARGIN, y, size: 8, font: fontBold, color: GRAY });
  if (hasTreatedBy) {
    page.drawText("TREATED BY", { x: treatedByX, y, size: 8, font: fontBold, color: GRAY });
  }
  y -= 16;
  page.drawText(input.patientName, { x: MARGIN, y, size: 12, font: fontBold, color: DARK });
  if (hasTreatedBy) {
    page.drawText(input.treatedByNames!.join(", "), { x: treatedByX, y, size: 12, font: fontBold, color: DARK, maxWidth: rightColX - treatedByX });
  }
  y -= 15;
  page.drawText(input.patientPhone, { x: MARGIN, y, size: 10, font, color: GRAY });
  y -= 30;

  // A4 has much less horizontal room than the photographed register, so use
  // compact type and a two-line heading for the seven requested columns.
  const columns = [MARGIN, 77, 155, 300, 356, 391, 466, rightColX];
  const tableBottom = MARGIN + 52;
  const drawRule = (atY: number) => {
    page.drawLine({ start: { x: MARGIN, y: atY }, end: { x: rightColX, y: atY }, thickness: 0.55, color: LIGHT_LINE });
  };
  const rightText = (value: string, column: number, atY: number, strong = false) => {
    const face = strong ? fontBold : font;
    const size = 8;
    page.drawText(value, {
      x: columns[column + 1]! - face.widthOfTextAtSize(value, size) - 5,
      y: atY,
      size,
      font: face,
      color: DARK,
    });
  };
  const drawHeader = () => {
    page.drawRectangle({ x: MARGIN, y: y - 32, width: rightColX - MARGIN, height: 36, color: rgb(0.93, 0.96, 0.99) });
    drawRule(y + 4);
    drawRule(y - 32);
    const headings: string[][] = [["S.No"], ["Procedure", "Type"], ["Particulars"], ["Cost"], ["Units"], ["Net Amt"], ["Gross", "Amt"]];
    headings.forEach((lines, index) => {
      lines.forEach((line, lineIndex) => page.drawText(line, {
        x: columns[index]! + 4,
        y: y - 10 - lineIndex * 10,
        size: 8,
        font: fontBold,
        color: DARK,
      }));
    });
    columns.slice(1, -1).forEach((x) => page.drawLine({
      start: { x, y: y + 4 }, end: { x, y: y - 32 }, thickness: 0.5, color: LIGHT_LINE,
    }));
    y -= 32;
  };
  const newTablePage = () => {
    page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    drawPageChrome(page, logo, fontBold, font, input.generatedByName);
    page.drawLine({ start: { x: MARGIN, y: top - DIVIDER_Y }, end: { x: rightColX, y: top - DIVIDER_Y }, thickness: 1, color: LIGHT_LINE });
    page.drawText(`${invoiceNo} - continued`, { x: MARGIN, y: top - DIVIDER_Y - 20, size: 10, font: fontBold, color: BRAND_BLUE });
    y = top - DIVIDER_Y - 45;
    drawHeader();
  };
  const wrapText = (value: string, width: number, size: number): string[] => {
    const lines: string[] = [];
    let line = "";
    for (const word of value.split(/\s+/)) {
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= width) {
        line = candidate;
      } else {
        if (line) lines.push(line);
        line = "";
        for (const character of word) {
          if (font.widthOfTextAtSize(line + character, size) > width && line) {
            lines.push(line);
            line = "";
          }
          line += character;
        }
      }
    }
    if (line) lines.push(line);
    return lines.length ? lines : [""];
  };
  drawHeader();

  for (const [index, item] of input.items.entries()) {
    const particularsLines = wrapText(item.description, columns[3]! - columns[2]! - 8, 8);
    const rowHeight = Math.max(27, particularsLines.length * 11 + 12);
    if (y - rowHeight < tableBottom) newTablePage();
    const units = Math.max(1, item.units ?? 1);
    const procedureType = item.description.toLowerCase() === "consultation fee" ? "CONSULTATION" : "PROCEDURE";
    const baseline = y - 17;
    page.drawText(String(index + 1), { x: columns[0]! + 5, y: baseline, size: 8, font, color: DARK });
    page.drawText(procedureType, { x: columns[1]! + 4, y: baseline, size: 7.3, font, color: DARK });
    particularsLines.forEach((line, lineIndex) => page.drawText(line, {
      x: columns[2]! + 4, y: baseline - lineIndex * 11, size: 8, font, color: DARK,
    }));
    rightText(formatCellAmount(item.amount / units), 3, baseline);
    rightText(String(units), 4, baseline);
    // No tax, and no per-item discount, is configured in this app - a
    // discount is invoice-level only (see the summary below), so both
    // amounts here represent the same actual line total.
    rightText(formatCellAmount(item.amount), 5, baseline);
    rightText(formatCellAmount(item.amount), 6, baseline);
    drawRule(y - rowHeight);
    columns.slice(1, -1).forEach((x) => page.drawLine({
      start: { x, y }, end: { x, y: y - rowHeight }, thickness: 0.5, color: LIGHT_LINE,
    }));
    y -= rowHeight;
  }

  const beginSummaryPage = () => {
    page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    drawPageChrome(page, logo, fontBold, font, input.generatedByName);
    page.drawLine({ start: { x: MARGIN, y: top - DIVIDER_Y }, end: { x: rightColX, y: top - DIVIDER_Y }, thickness: 1, color: LIGHT_LINE });
    page.drawText(`${invoiceNo} - continued`, { x: MARGIN, y: top - DIVIDER_Y - 20, size: 10, font: fontBold, color: BRAND_BLUE });
    y = top - DIVIDER_Y - 45;
  };
  const ensureRoom = (height: number) => {
    if (y - height < tableBottom) beginSummaryPage();
  };
  const subtotal = input.subtotal ?? input.totalAmount;
  const discountValue = Math.max(0, Math.round((subtotal - input.totalAmount) * 100) / 100);
  const showDiscount = discountValue > 0;
  ensureRoom(showDiscount ? 124 : 88);
  y -= 20;
  const balanceDue = Math.max(0, input.totalAmount - input.amountPaid);
  const summaryRow = (label: string, amount: number, strong = false, prefix = "") => {
    page.drawText(label, { x: columns[4]!, y, size: 9, font: strong ? fontBold : font, color: DARK });
    const value = `${prefix}${formatMoney(amount)}`;
    page.drawText(value, { x: rightColX - fontBold.widthOfTextAtSize(value, 9) - 4, y, size: 9, font: strong ? fontBold : font, color: DARK });
    y -= 18;
  };
  if (showDiscount) {
    summaryRow("Subtotal", subtotal);
    const pct = input.discountPercent ?? 0;
    const amt = input.discountAmount ?? 0;
    const parts = [pct > 0 ? `${pct}%` : null, amt > 0 ? formatMoney(amt) : null].filter((v): v is string => v !== null);
    summaryRow(parts.length ? `Discount (${parts.join(" + ")})` : "Discount", discountValue, false, "- ");
  }
  summaryRow("Total Gross Amt", input.totalAmount, true);
  summaryRow("Received", input.amountPaid);
  summaryRow("Balance due", balanceDue, true);
  drawRule(y + 6);
  y -= 11;

  const paymentLines = input.payments?.length
    ? input.payments.map((payment) => `By ${paymentLabel(payment.method, payment.note)}: ${formatCellAmount(payment.amount)}`)
    : ["No payment recorded"];
  ensureRoom(28);
  page.drawText("Payment Details:", { x: MARGIN + 5, y, size: 9, font: fontBold, color: DARK });
  y -= 15;
  for (const line of paymentLines) {
    for (const part of wrapText(line, rightColX - MARGIN - 20, 8.5)) {
      ensureRoom(18);
      page.drawText(part, { x: MARGIN + 10, y, size: 8.5, font, color: DARK });
      y -= 15;
    }
  }
  y -= 5;
  ensureRoom(33);
  page.drawText("Amount (in words):", { x: MARGIN + 5, y, size: 9, font: fontBold, color: DARK });
  y -= 15;
  for (const line of wrapText(amountInWords(input.totalAmount), rightColX - MARGIN - 20, 8.5)) {
    ensureRoom(18);
    page.drawText(line, { x: MARGIN + 10, y, size: 8.5, font, color: DARK });
    y -= 15;
  }
  y -= 8;
  ensureRoom(22);
  page.drawText("Instructions:", { x: MARGIN + 5, y, size: 9, font: fontBold, color: DARK });
  y -= 15;
  const instructions = input.instructions?.trim() || "None";
  for (const paragraph of instructions.split(/\n/)) {
    for (const line of wrapText(paragraph, rightColX - MARGIN - 20, 8.5)) {
      if (y - 16 < tableBottom) {
        beginSummaryPage();
        page.drawText("Instructions (continued):", { x: MARGIN + 5, y, size: 9, font: fontBold, color: DARK });
        y -= 20;
      }
      page.drawText(line, { x: MARGIN + 10, y, size: 8.5, font, color: DARK });
      y -= 14;
    }
  }

  return pdfDoc.save();
}
