import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { TOOTH_CONDITIONS, type CreateTreatmentRecordInput } from "@clinic/shared";
import { usePatient, usePatientToothChart } from "../../hooks/usePatients.js";
import { useCreateTreatmentRecord, useTreatmentsList } from "../../hooks/useTreatments.js";
import { useFilesList, useUploadFile, fileDownloadUrl } from "../../hooks/useFiles.js";
import { useInvoicesList } from "../../hooks/useInvoices.js";
import { useAuth } from "../../auth/useAuth.js";
import { ToothChart } from "../../components/ToothChart.js";
import { formatDate, formatDateTime, todayDateInputValue } from "../../lib/dates.js";
import { ApiError } from "../../api/client.js";
import { Badge, Button, Card, EmptyState, FieldError, Input, Label, PageHeader, Select, Textarea } from "../../components/ui.js";

type Tab = "overview" | "chart" | "treatments" | "files" | "billing";

export function PatientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [tab, setTab] = useState<Tab>("overview");
  const { data: patient, isLoading } = usePatient(id);

  if (isLoading) return <p className="text-sm text-slate-400">Loading…</p>;
  if (!patient) return <p className="text-sm text-slate-500">Patient not found.</p>;

  const tabs: { key: Tab; label: string }[] = [
    { key: "overview", label: "Overview" },
    { key: "chart", label: "Tooth chart" },
    { key: "treatments", label: "Treatment notes" },
    { key: "files", label: "X-rays & files" },
    { key: "billing", label: "Billing" },
  ];

  return (
    <div>
      <PageHeader
        title={patient.name}
        subtitle={`${patient.phone}${patient.dateOfBirth ? ` · DOB ${formatDate(patient.dateOfBirth)}` : ""}`}
        action={
          <Link to={`/patients/${id}/edit`}>
            <Button variant="secondary">Edit details</Button>
          </Link>
        }
      />
      <div className="mb-4 flex gap-1 overflow-x-auto border-b border-slate-200">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium ${
              tab === t.key ? "border-brand-700 text-brand-800" : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <Card>
          <dl className="grid grid-cols-3 gap-y-3 text-sm">
            <dt className="text-slate-500">Phone</dt>
            <dd className="col-span-2">{patient.phone}</dd>
            <dt className="text-slate-500">Email</dt>
            <dd className="col-span-2">{patient.email ?? "—"}</dd>
            <dt className="text-slate-500">Address</dt>
            <dd className="col-span-2">{patient.address ?? "—"}</dd>
            <dt className="text-slate-500">Medical history</dt>
            <dd className="col-span-2 whitespace-pre-wrap">{patient.medicalHistoryNotes ?? "—"}</dd>
          </dl>
        </Card>
      )}
      {tab === "chart" && <ToothChartTab patientId={id!} onGoToTreatments={() => setTab("treatments")} />}
      {tab === "treatments" && <TreatmentsTab patientId={id!} />}
      {tab === "files" && <FilesTab patientId={id!} />}
      {tab === "billing" && <BillingTab patientId={id!} />}
    </div>
  );
}

function ToothChartTab({ patientId, onGoToTreatments }: { patientId: string; onGoToTreatments: () => void }) {
  const { data: chart, isLoading } = usePatientToothChart(patientId);
  return (
    <Card>
      {isLoading && <p className="text-sm text-slate-400">Loading…</p>}
      {chart && (
        <ToothChart entries={chart} onSelectTooth={onGoToTreatments} />
      )}
      <p className="mt-4 text-xs text-slate-400">
        Shows the most recent condition recorded per tooth. Tap a tooth, then add a treatment note against it.
      </p>
    </Card>
  );
}

function TreatmentsTab({ patientId }: { patientId: string }) {
  const { user } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const { data: treatments, isLoading } = useTreatmentsList(patientId);
  const createTreatment = useCreateTreatmentRecord(patientId);
  const canWrite = user?.role === "doctor";

  return (
    <div className="space-y-4">
      {canWrite && (
        <div className="flex justify-end">
          <Button size="sm" onClick={() => setShowForm((v) => !v)}>
            {showForm ? "Close" : "+ Add treatment note"}
          </Button>
        </div>
      )}
      {showForm && (
        <TreatmentForm
          patientId={patientId}
          staffId={user!.id}
          onSaved={() => setShowForm(false)}
          mutate={createTreatment}
        />
      )}
      <Card>
        {isLoading && <p className="text-sm text-slate-400">Loading…</p>}
        {!isLoading && treatments?.length === 0 && <EmptyState>No treatment notes yet.</EmptyState>}
        <ul className="divide-y divide-slate-100">
          {treatments?.map((t) => (
            <li key={t.id} className="py-3 text-sm">
              <div className="flex items-center justify-between">
                <p className="font-medium text-slate-900">
                  {t.procedure} {t.toothNumber && <span className="text-slate-400">· Tooth {t.toothNumber}</span>}
                </p>
                <Badge tone={t.status === "planned" ? "amber" : "green"}>{t.status}</Badge>
              </div>
              <p className="text-xs text-slate-400">{formatDate(t.date)}</p>
              {t.notes && <p className="mt-1 text-slate-600">{t.notes}</p>}
              {t.prescription && (
                <p className="mt-1 text-slate-600">
                  <span className="font-medium">Prescription:</span> {t.prescription}
                </p>
              )}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

function TreatmentForm({
  patientId,
  staffId,
  onSaved,
  mutate,
}: {
  patientId: string;
  staffId: string;
  onSaved: () => void;
  mutate: ReturnType<typeof useCreateTreatmentRecord>;
}) {
  const [form, setForm] = useState<Partial<CreateTreatmentRecordInput>>({
    date: todayDateInputValue(),
    status: "completed",
  });
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.procedure) {
      setError("Describe the procedure.");
      return;
    }
    try {
      await mutate.mutateAsync({
        ...form,
        patientId,
        staffId,
        procedure: form.procedure,
        date: form.date!,
        status: form.status ?? "completed",
      });
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save.");
    }
  }

  return (
    <Card>
      <form onSubmit={onSubmit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="procedure">Procedure</Label>
            <Input
              id="procedure"
              value={form.procedure ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, procedure: e.target.value }))}
            />
          </div>
          <div>
            <Label htmlFor="date">Date</Label>
            <Input
              id="date"
              type="date"
              value={form.date ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="tooth">Tooth (optional)</Label>
            <Input
              id="tooth"
              placeholder="e.g. 16"
              value={form.toothNumber ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, toothNumber: e.target.value || undefined }))}
            />
          </div>
          <div>
            <Label htmlFor="condition">Tooth condition (optional)</Label>
            <Select
              id="condition"
              value={form.condition ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, condition: (e.target.value || undefined) as never }))}
            >
              <option value="">No change</option>
              {TOOTH_CONDITIONS.map((c) => (
                <option key={c} value={c}>
                  {c.replace(/_/g, " ")}
                </option>
              ))}
            </Select>
          </div>
        </div>
        <div>
          <Label htmlFor="status">Status</Label>
          <Select id="status" value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as never }))}>
            <option value="completed">Completed</option>
            <option value="planned">Planned</option>
          </Select>
        </div>
        <div>
          <Label htmlFor="notes">Notes (optional)</Label>
          <Textarea id="notes" rows={2} value={form.notes ?? ""} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
        </div>
        <div>
          <Label htmlFor="prescription">Prescription (optional)</Label>
          <Textarea
            id="prescription"
            rows={2}
            value={form.prescription ?? ""}
            onChange={(e) => setForm((f) => ({ ...f, prescription: e.target.value }))}
          />
        </div>
        <FieldError>{error}</FieldError>
        <Button type="submit" disabled={mutate.isPending}>
          {mutate.isPending ? "Saving…" : "Save treatment note"}
        </Button>
      </form>
    </Card>
  );
}

function FilesTab({ patientId }: { patientId: string }) {
  const { data: files, isLoading } = useFilesList(patientId);
  const upload = useUploadFile();
  const [type, setType] = useState<"xray" | "photo" | "document" | "other">("xray");
  const [error, setError] = useState<string | null>(null);

  async function onFileChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    try {
      await upload.mutateAsync({ patientId, type, file });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Upload failed. Check your connection and try again.");
    } finally {
      e.target.value = "";
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <Label htmlFor="fileType">Type</Label>
            <Select id="fileType" value={type} onChange={(e) => setType(e.target.value as typeof type)}>
              <option value="xray">X-ray</option>
              <option value="photo">Photo</option>
              <option value="document">Document</option>
              <option value="other">Other</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="fileUpload">Upload (JPEG, PNG, WEBP, HEIC or PDF, up to 25MB)</Label>
            <input id="fileUpload" type="file" accept=".jpg,.jpeg,.png,.webp,.heic,.pdf" onChange={(e) => void onFileChosen(e)} />
          </div>
          {upload.isPending && <span className="text-sm text-slate-400">Uploading…</span>}
        </div>
        <FieldError>{error}</FieldError>
      </Card>
      <Card>
        {isLoading && <p className="text-sm text-slate-400">Loading…</p>}
        {!isLoading && files?.length === 0 && <EmptyState>No files uploaded yet.</EmptyState>}
        <ul className="divide-y divide-slate-100">
          {files?.map((f) => (
            <li key={f.id} className="flex items-center justify-between py-3 text-sm">
              <div>
                <a href={fileDownloadUrl(f.id)} target="_blank" rel="noreferrer" className="font-medium text-brand-700 hover:underline">
                  {f.fileName}
                </a>
                <p className="text-xs text-slate-400">
                  {f.type} · {formatDateTime(f.uploadedAt)}
                </p>
              </div>
              <Badge>{Math.round(f.sizeBytes / 1024)} KB</Badge>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

function BillingTab({ patientId }: { patientId: string }) {
  const { data } = useInvoicesList(patientId);
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Link to={`/billing/new?patientId=${patientId}`}>
          <Button size="sm">+ New invoice</Button>
        </Link>
      </div>
      <Card>
        {data?.items.length === 0 && <EmptyState>No invoices for this patient yet.</EmptyState>}
        <ul className="divide-y divide-slate-100">
          {data?.items.map((invoice) => (
            <li key={invoice.id}>
              <Link to={`/billing/${invoice.id}`} className="flex items-center justify-between py-3 text-sm hover:bg-slate-50">
                <div>
                  <p className="font-medium text-slate-900">₹{invoice.totalAmount.toFixed(2)}</p>
                  <p className="text-xs text-slate-400">{formatDate(invoice.date)}</p>
                </div>
                <Badge tone={invoice.status === "paid" ? "green" : invoice.status === "cancelled" ? "red" : "amber"}>
                  {invoice.status.replace("_", " ")}
                </Badge>
              </Link>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
