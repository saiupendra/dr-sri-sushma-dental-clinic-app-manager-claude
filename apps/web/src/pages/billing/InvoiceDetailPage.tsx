import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { buildWhatsAppUrl, CLINIC_NAME, PAYMENT_METHODS, type PaymentMethod } from "@clinic/shared";
import {
  invoicePdfUrl,
  invoicePublicPdfUrl,
  useDeletePayment,
  useInvoice,
  useRecordPayment,
} from "../../hooks/useInvoices.js";
import { usePatient } from "../../hooks/usePatients.js";
import { formatDateTime } from "../../lib/dates.js";
import { ApiError } from "../../api/client.js";
import { Badge, Button, Card, FieldError, Input, Label, PageHeader, Select } from "../../components/ui.js";

const PAYMENT_LABELS: Record<string, string> = {
  cash: "Cash", card: "Card", upi: "UPI", amazon_pay: "Amazon Pay", netbanking: "Net banking", other: "Other",
};

export function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: invoice, isLoading } = useInvoice(id);
  const { data: patient } = usePatient(invoice?.patientId);
  const recordPayment = useRecordPayment(id ?? "");
  const deletePayment = useDeletePayment(id ?? "");

  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [error, setError] = useState<string | null>(null);

  if (isLoading) return <p className="text-sm text-slate-400">Loading…</p>;
  if (!invoice) return <p className="text-sm text-slate-500">Invoice not found.</p>;

  const outstanding = invoice.totalAmount - invoice.amountPaid;

  function onSendViaWhatsApp() {
    if (!invoice || !patient || !invoice.shareToken) return;
    const shareUrl = invoicePublicPdfUrl(invoice.id, invoice.shareToken);
    const message = `Hi ${patient.name}, here is your invoice from ${CLINIC_NAME}: total ₹${invoice.totalAmount.toFixed(2)}${outstanding > 0 ? `, balance due ₹${outstanding.toFixed(2)}` : ""}. View or download it here: ${shareUrl}`;
    window.open(buildWhatsAppUrl(patient.phone, message), "_blank", "noopener");
  }

  async function onRecordPayment(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const value = Number(amount);
    if (!value || value <= 0) {
      setError("Enter a valid amount.");
      return;
    }
    try {
      await recordPayment.mutateAsync({ amount: value, method });
      setAmount("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not record the payment.");
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <PageHeader
        title={`Invoice · ₹${invoice.totalAmount.toFixed(2)}`}
        subtitle={formatDateTime(invoice.date)}
        action={<Badge tone={invoice.status === "paid" ? "green" : invoice.status === "cancelled" ? "red" : "amber"}>{invoice.status.replace("_", " ")}</Badge>}
      />

      {patient && (
        <Card>
          <div className="flex items-start justify-between gap-3">
            <div>
              <Link to={`/patients/${patient.id}`} className="font-medium text-brand-700 hover:underline">
                {patient.name}
              </Link>
              <p className="text-sm text-slate-500">{patient.phone}</p>
            </div>
            <div className="flex shrink-0 gap-2">
              <a
                href={invoicePdfUrl(invoice.id)}
                className="inline-flex items-center justify-center rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                Download
              </a>
              <Button size="sm" variant="secondary" onClick={onSendViaWhatsApp} disabled={!invoice.shareToken}>
                Send via WhatsApp
              </Button>
            </div>
          </div>
        </Card>
      )}

      <Card>
        <h2 className="mb-3 text-sm font-semibold text-slate-700">Invoice details</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] border-collapse text-left text-xs text-slate-700">
            <thead className="bg-blue-50 text-slate-900">
              <tr>
                {["S.No", "Procedure Type", "Particulars", "Cost", "Units", "Net Amt", "Gross Amt"].map((header) => (
                  <th key={header} className="border border-slate-200 px-2 py-2 font-semibold">{header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {invoice.items.map((item, index) => (
                <tr key={item.id}>
                  <td className="border border-slate-200 px-2 py-2">{index + 1}</td>
                  <td className="border border-slate-200 px-2 py-2">{item.description.toLowerCase() === "consultation fee" ? "CONSULTATION" : "PROCEDURE"}</td>
                  <td className="border border-slate-200 px-2 py-2">{item.description}</td>
                  <td className="border border-slate-200 px-2 py-2 text-right">₹{(item.amount / item.units).toFixed(2)}</td>
                  <td className="border border-slate-200 px-2 py-2 text-right">{item.units}</td>
                  <td className="border border-slate-200 px-2 py-2 text-right">₹{item.amount.toFixed(2)}</td>
                  <td className="border border-slate-200 px-2 py-2 text-right">₹{item.amount.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-4 ml-auto max-w-xs space-y-2 text-sm">
          <div className="flex justify-between font-semibold text-slate-900"><span>Total Gross Amt</span><span>₹{invoice.totalAmount.toFixed(2)}</span></div>
          <div className="flex justify-between text-slate-600"><span>Received</span><span>₹{invoice.amountPaid.toFixed(2)}</span></div>
          <div className="flex justify-between border-t border-slate-200 pt-2 font-semibold text-slate-900"><span>Balance due</span><span>₹{Math.max(0, outstanding).toFixed(2)}</span></div>
        </div>
        <div className="mt-4 border-t border-slate-100 pt-3 text-sm">
          <p className="font-semibold text-slate-800">Instructions</p>
          <p className="mt-1 whitespace-pre-wrap text-slate-600">{invoice.notes || "None"}</p>
        </div>
      </Card>

      <Card>
        <h2 className="mb-2 text-sm font-semibold text-slate-700">Payments</h2>
        {invoice.payments.length === 0 && <p className="text-sm text-slate-400">No payments recorded yet.</p>}
        <ul className="divide-y divide-slate-100 text-sm">
          {invoice.payments.map((payment) => (
            <li key={payment.id} className="flex items-center justify-between py-2">
              <div>
                <span className="font-medium">₹{payment.amount.toFixed(2)}</span>{" "}
                <span className="text-slate-400">via {PAYMENT_LABELS[payment.method] ?? payment.method}</span>
                <p className="text-xs text-slate-400">{formatDateTime(payment.paidAt)}</p>
              </div>
              <Button size="sm" variant="ghost" onClick={() => deletePayment.mutate(payment.id)}>
                Remove
              </Button>
            </li>
          ))}
        </ul>

        {invoice.status !== "cancelled" && outstanding > 0 && (
          <form onSubmit={onRecordPayment} className="mt-4 flex items-end gap-2 border-t border-slate-100 pt-4">
            <div className="flex-1">
              <Label htmlFor="amount">Record a payment</Label>
              <Input id="amount" type="number" min={0} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Amount" />
            </div>
            <div>
              <Label htmlFor="method">Method</Label>
              <Select id="method" value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
                {PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {PAYMENT_LABELS[m]}
                  </option>
                ))}
              </Select>
            </div>
            <Button type="submit" disabled={recordPayment.isPending}>
              Record
            </Button>
          </form>
        )}
        <FieldError>{error}</FieldError>
      </Card>
    </div>
  );
}
