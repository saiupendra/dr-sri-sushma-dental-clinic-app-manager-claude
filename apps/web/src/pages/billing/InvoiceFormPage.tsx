import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import type { CreateInvoiceItemInput } from "@clinic/shared";
import { useCreateInvoice } from "../../hooks/useInvoices.js";
import { PatientPicker, type PickedPatient } from "../../components/PatientPicker.js";
import { usePatient } from "../../hooks/usePatients.js";
import { useTreatmentsList } from "../../hooks/useTreatments.js";
import { ApiError } from "../../api/client.js";
import { Button, Card, EmptyState, FieldError, Input, Label, PageHeader } from "../../components/ui.js";

export function InvoiceFormPage() {
  const [searchParams] = useSearchParams();
  const preselectedPatientId = searchParams.get("patientId") ?? undefined;
  const { data: preselectedPatient } = usePatient(preselectedPatientId);
  const navigate = useNavigate();
  const createInvoice = useCreateInvoice();

  const [patient, setPatient] = useState<PickedPatient | null>(null);
  const [items, setItems] = useState<CreateInvoiceItemInput[]>([{ description: "", amount: 0 }]);
  const [error, setError] = useState<string | null>(null);

  const effectivePatient =
    patient ?? (preselectedPatient ? { id: preselectedPatient.id, name: preselectedPatient.name, phone: preselectedPatient.phone } : null);

  const { data: treatments, isLoading: treatmentsLoading } = useTreatmentsList(effectivePatient?.id);
  const hasCompletedTreatment = !!treatments?.some((t) => t.status === "completed");
  // A fee is only known once a treatment has actually happened, so there's
  // nothing to invoice yet for a patient with no completed treatment.
  const blockedByNoCompletedTreatment = !!effectivePatient && !treatmentsLoading && !hasCompletedTreatment;

  const total = items.reduce((sum, item) => sum + (Number.isFinite(item.amount) ? item.amount : 0), 0);

  function updateItem(index: number, patch: Partial<CreateInvoiceItemInput>) {
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
      setError("This patient has no completed treatment yet. Add or complete a treatment note before creating an invoice.");
      return;
    }
    const cleanItems = items.filter((item) => item.description.trim() && Number.isFinite(item.amount) && item.amount >= 0);
    if (cleanItems.length === 0) {
      setError("Add at least one line item with a description.");
      return;
    }
    try {
      const result = await createInvoice.mutateAsync({ patientId: effectivePatient.id, items: cleanItems });
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
              This patient has no completed treatment yet. Add or complete a treatment note before creating an
              invoice.
            </EmptyState>
          )}
          <div className={blockedByNoCompletedTreatment ? "pointer-events-none opacity-50" : undefined}>
            <Label>Line items</Label>
            <div className="space-y-2">
              {items.map((item, i) => (
                <div key={i} className="flex gap-2">
                  <Input
                    placeholder="Description (e.g. Scaling and polishing)"
                    value={item.description}
                    onChange={(e) => updateItem(i, { description: e.target.value })}
                    className="flex-1"
                  />
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    placeholder="Amount"
                    value={item.amount || ""}
                    onChange={(e) => updateItem(i, { amount: Number(e.target.value) })}
                    className="w-32"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setItems((prev) => prev.filter((_, idx) => idx !== i))}
                    disabled={items.length === 1}
                  >
                    ✕
                  </Button>
                </div>
              ))}
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="mt-2"
              onClick={() => setItems((prev) => [...prev, { description: "", amount: 0 }])}
            >
              + Add line
            </Button>
          </div>
          <div className="flex items-center justify-between border-t border-slate-100 pt-3 text-sm font-semibold text-slate-900">
            <span>Total</span>
            <span>₹{total.toFixed(2)}</span>
          </div>
          <FieldError>{error}</FieldError>
          <div className="flex gap-2">
            <Button type="submit" disabled={createInvoice.isPending || blockedByNoCompletedTreatment}>
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
