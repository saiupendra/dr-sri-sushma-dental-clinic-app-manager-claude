import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import type { CreateInvoiceItemInput } from "@clinic/shared";
import { useCreateInvoice } from "../../hooks/useInvoices.js";
import { PatientPicker, type PickedPatient } from "../../components/PatientPicker.js";
import { usePatient } from "../../hooks/usePatients.js";
import { useTreatmentsList } from "../../hooks/useTreatments.js";
import { ApiError } from "../../api/client.js";
import { Button, Card, EmptyState, FieldError, Input, Label, PageHeader, Textarea } from "../../components/ui.js";

type InvoiceDraftItem = CreateInvoiceItemInput & { unitCost: number };

export function InvoiceFormPage() {
  const [searchParams] = useSearchParams();
  const preselectedPatientId = searchParams.get("patientId") ?? undefined;
  const { data: preselectedPatient } = usePatient(preselectedPatientId);
  const navigate = useNavigate();
  const createInvoice = useCreateInvoice();

  const [patient, setPatient] = useState<PickedPatient | null>(null);
  // Additional charges only - the consultation fee below is never part of
  // this list. The server prepends it unconditionally (see POST
  // /api/invoices), so this can legitimately stay empty.
  const [items, setItems] = useState<InvoiceDraftItem[]>([]);
  const [instructions, setInstructions] = useState("");
  const [discountPercent, setDiscountPercent] = useState("");
  const [discountAmount, setDiscountAmount] = useState("");
  const [error, setError] = useState<string | null>(null);

  const effectivePatient =
    patient ?? (preselectedPatient ? { id: preselectedPatient.id, name: preselectedPatient.name, phone: preselectedPatient.phone } : null);

  // Full record (PatientPicker only hands back id/name/phone) for the
  // consultation fee display below.
  const { data: fullPatient } = usePatient(effectivePatient?.id);
  const consultationFee = fullPatient?.consultationFee ?? 0;

  const { data: treatments, isLoading: treatmentsLoading } = useTreatmentsList(effectivePatient?.id);
  const hasCompletedTreatment = !!treatments?.some((t) => t.status === "completed");
  // A fee is only known once a treatment has actually happened, so there's
  // nothing to invoice yet for a patient with no completed treatment.
  const blockedByNoCompletedTreatment = !!effectivePatient && !treatmentsLoading && !hasCompletedTreatment;

  const subtotal = consultationFee + items.reduce((sum, item) => sum + (Number.isFinite(item.amount) ? item.amount : 0), 0);
  const discountPercentValue = Math.min(100, Math.max(0, Number(discountPercent) || 0));
  const discountAmountValue = Math.max(0, Number(discountAmount) || 0);
  const discountValue = Math.min(subtotal, subtotal * (discountPercentValue / 100) + discountAmountValue);
  const total = Math.round((subtotal - discountValue) * 100) / 100;

  function updateItem(index: number, patch: Partial<InvoiceDraftItem>) {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!effectivePatient) {
      setError("Choose a patient first.");
      return;
    }
    if (blockedByNoCompletedTreatment) {
      setError("This patient has no completed treatment yet. A completed appointment alone isn't enough — add or complete a treatment note first.");
      return;
    }
    // The consultation fee itself is never in `items` - the server adds it
    // from the patient's record regardless, so an empty list here (no
    // *additional* charges) is a perfectly valid invoice.
    const cleanItems = items.filter((item) => item.description.trim() && Number.isFinite(item.unitCost) && item.unitCost >= 0 && Number.isInteger(item.units) && item.units > 0 && item.units <= 999);
    try {
      if (cleanItems.length !== items.length) {
        setError("Complete every additional charge with a description, cost and valid number of units.");
        return;
      }
      const result = await createInvoice.mutateAsync({
        patientId: effectivePatient.id,
        items: cleanItems.map(({ unitCost: _unitCost, ...item }) => item),
        notes: instructions.trim(),
        discountPercent: discountPercentValue,
        discountAmount: discountAmountValue,
      });
      navigate(`/billing/${result.item.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create the invoice.");
    }
  }

  return (
    <div className="mx-auto max-w-lg">
      <PageHeader title="New invoice" />
      <Card>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <Label>Patient</Label>
            {preselectedPatientId ? (
              <p className="text-sm font-medium text-slate-900">{effectivePatient?.name}</p>
            ) : (
              <PatientPicker value={patient} onChange={setPatient} />
            )}
          </div>
          {effectivePatient && treatmentsLoading && <p className="text-sm text-slate-400">Checking treatment history…</p>}
          {blockedByNoCompletedTreatment && (
            <EmptyState>
              This patient has no completed treatment yet — a completed appointment on its own doesn&apos;t
              generate a fee. Add a treatment note for the visit, or mark an existing one completed, then come
              back here.{" "}
              <Link to={`/patients/${effectivePatient.id}?tab=treatments`} className="font-medium text-brand-700 hover:underline">
                Go to treatment notes →
              </Link>
            </EmptyState>
          )}
          <div className={blockedByNoCompletedTreatment ? "pointer-events-none opacity-50" : undefined}>
            <Label>Consultation fee</Label>
            <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
              <span className="text-slate-500">Set on the patient&apos;s profile - can&apos;t be edited or removed here</span>
              <span className="font-medium text-slate-900">{effectivePatient && !fullPatient ? "…" : `₹${consultationFee.toFixed(2)}`}</span>
            </div>
          </div>
          <div className={blockedByNoCompletedTreatment ? "pointer-events-none opacity-50" : undefined}>
            <Label>Additional charges</Label>
            <div className="space-y-3">
              {items.map((item, i) => (
                <div key={i} className="space-y-2 rounded-lg border border-slate-200 p-2">
                  <Input
                    placeholder="Description (e.g. Scaling and polishing)"
                    value={item.description}
                    onChange={(e) => updateItem(i, { description: e.target.value })}
                  />
                  <div className="flex items-end gap-2">
                    <div className="flex-1">
                      <Label htmlFor={`cost-${i}`}>Cost per unit</Label>
                      <Input
                        id={`cost-${i}`}
                        type="number"
                        min={0}
                        step="0.01"
                        placeholder="Cost"
                        value={item.unitCost || ""}
                        onChange={(e) => {
                          const unitCost = Number(e.target.value);
                          updateItem(i, { unitCost, amount: Math.round(unitCost * item.units * 100) / 100 });
                        }}
                      />
                    </div>
                    <div className="w-20">
                      <Label htmlFor={`units-${i}`}>Units</Label>
                      <Input
                        id={`units-${i}`}
                        type="number"
                        min={1}
                        max={999}
                        step={1}
                        value={item.units}
                        onChange={(e) => {
                          const units = Number(e.target.value);
                          updateItem(i, { units, amount: Math.round(item.unitCost * units * 100) / 100 });
                        }}
                      />
                    </div>
                    <Button type="button" variant="ghost" onClick={() => setItems((prev) => prev.filter((_, idx) => idx !== i))}>
                      ✕
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="mt-2"
              onClick={() => setItems((prev) => [...prev, { description: "", amount: 0, units: 1, unitCost: 0 }])}
            >
              + Add line
            </Button>
          </div>
          <div className={blockedByNoCompletedTreatment ? "pointer-events-none opacity-50" : undefined}>
            <Label>Discount (optional)</Label>
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <Label htmlFor="discountPercent">Percentage</Label>
                <Input
                  id="discountPercent"
                  type="number"
                  min={0}
                  max={100}
                  step="0.01"
                  placeholder="0"
                  value={discountPercent}
                  onChange={(e) => setDiscountPercent(e.target.value)}
                />
              </div>
              <div className="flex-1">
                <Label htmlFor="discountAmount">Cash amount (₹)</Label>
                <Input
                  id="discountAmount"
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="0"
                  value={discountAmount}
                  onChange={(e) => setDiscountAmount(e.target.value)}
                />
              </div>
            </div>
            <p className="mt-1 text-xs text-slate-400">Both can be used together - they're combined, capped at the invoice subtotal.</p>
          </div>
          <div>
            <Label htmlFor="instructions">Instructions (optional)</Label>
            <Textarea
              id="instructions"
              rows={3}
              maxLength={2000}
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="Aftercare or payment instructions printed on the invoice"
            />
          </div>
          <div className="space-y-1 border-t border-slate-100 pt-3 text-sm">
            {discountValue > 0 && (
              <>
                <div className="flex items-center justify-between text-slate-600">
                  <span>Subtotal</span>
                  <span>₹{subtotal.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between text-slate-600">
                  <span>Discount</span>
                  <span>- ₹{discountValue.toFixed(2)}</span>
                </div>
              </>
            )}
            <div className="flex items-center justify-between font-semibold text-slate-900">
              <span>Total</span>
              <span>₹{total.toFixed(2)}</span>
            </div>
          </div>
          <FieldError>{error}</FieldError>
          <div className="flex gap-2">
            <Button
              type="submit"
              disabled={createInvoice.isPending || blockedByNoCompletedTreatment || (!!effectivePatient && !fullPatient)}
            >
              {createInvoice.isPending ? "Saving…" : "Create invoice"}
            </Button>
            <Button type="button" variant="secondary" onClick={() => navigate(-1)}>
              Cancel
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
