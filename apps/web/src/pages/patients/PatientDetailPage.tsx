import { useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { TOOTH_CONDITIONS, type CreateTreatmentRecordInput, type TreatmentRecord } from "@clinic/shared";
import { usePatient, usePatientToothChart } from "../../hooks/usePatients.js";
import {
  useCreateTreatmentRecord,
  useTreatmentsList,
  useUpdateTreatmentRecord,
  useUpdateTreatmentStatus,
} from "../../hooks/useTreatments.js";
import { useDeleteFile, useFilesList, useUploadFile, fileDownloadUrl } from "../../hooks/useFiles.js";
import { useInvoicesList } from "../../hooks/useInvoices.js";
import { useAuth } from "../../auth/useAuth.js";
import { ToothChart } from "../../components/ToothChart.js";
import { formatDate, formatDateTime, todayDateInputValue } from "../../lib/dates.js";
import { compressImageForUpload } from "../../lib/imageCompression.js";
import { ApiError } from "../../api/client.js";
import { Badge, Button, Card, EmptyState, FieldError, Input, Label, PageHeader, Select, Textarea } from "../../components/ui.js";

type Tab = "overview" | "chart" | "treatments" | "files" | "billing";
const TAB_VALUES: Tab[] = ["overview", "chart", "treatments", "files", "billing"];

export function PatientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  // Lets a link from elsewhere (e.g. an appointment) land directly on a tab,
  // for example /patients/:id?tab=treatments.
  const requestedTab = searchParams.get("tab");
  const initialTab: Tab = TAB_VALUES.includes(requestedTab as Tab) ? (requestedTab as Tab) : "overview";
  const [tab, setTab] = useState<Tab>(initialTab);
  const [prefillTeeth, setPrefillTeeth] = useState<string[]>([]);
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
        <div className="space-y-4">
          <Card>
            <ProfilePhoto patientId={id!} patientName={patient.name} />
          </Card>
          <Card>
            <dl className="grid grid-cols-3 gap-y-3 text-sm">
              <dt className="text-slate-500">Phone</dt>
              <dd className="col-span-2">{patient.phone}</dd>
              <dt className="text-slate-500">Email</dt>
              <dd className="col-span-2">{patient.email ?? "—"}</dd>
              <dt className="text-slate-500">Height</dt>
              <dd className="col-span-2">{patient.heightFeet != null ? `${patient.heightFeet} ft` : "—"}</dd>
              <dt className="text-slate-500">Weight</dt>
              <dd className="col-span-2">{patient.weightKg != null ? `${patient.weightKg} kg` : "—"}</dd>
              <dt className="text-slate-500">Blood pressure</dt>
              <dd className="col-span-2">{patient.bloodPressure ?? "—"}</dd>
              <dt className="text-slate-500">Blood sugar</dt>
              <dd className="col-span-2">{patient.bloodSugar ?? "—"}</dd>
              <dt className="text-slate-500">Consultation fee</dt>
              <dd className="col-span-2">
                {patient.consultationFee != null ? `₹${patient.consultationFee.toFixed(2)}` : "—"}
              </dd>
              <dt className="text-slate-500">Address</dt>
              <dd className="col-span-2">{patient.address ?? "—"}</dd>
              <dt className="text-slate-500">Medical history</dt>
              <dd className="col-span-2 whitespace-pre-wrap">{patient.medicalHistoryNotes ?? "—"}</dd>
            </dl>
          </Card>
        </div>
      )}
      {tab === "chart" && (
        <ToothChartTab
          patientId={id!}
          onNext={(teeth) => {
            setPrefillTeeth(teeth);
            setTab("treatments");
          }}
        />
      )}
      {tab === "treatments" && (
        <TreatmentsTab patientId={id!} prefillTeeth={prefillTeeth} onPrefillConsumed={() => setPrefillTeeth([])} />
      )}
      {tab === "files" && <FilesTab patientId={id!} />}
      {tab === "billing" && <BillingTab patientId={id!} />}
    </div>
  );
}

function ProfilePhoto({ patientId, patientName }: { patientId: string; patientName: string }) {
  const { data: files } = useFilesList(patientId);
  const upload = useUploadFile();
  const [error, setError] = useState<string | null>(null);

  const photo = files
    ?.filter((f) => f.type === "profile_photo")
    .sort((a, b) => (a.uploadedAt < b.uploadedAt ? 1 : -1))[0];

  async function onFileChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    try {
      await upload.mutateAsync({ patientId, type: "profile_photo", file: await compressImageForUpload(file) });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Upload failed. Check your connection and try again.");
    } finally {
      e.target.value = "";
    }
  }

  return (
    <div className="flex items-center gap-4">
      <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-100 text-2xl font-semibold text-slate-400">
        {photo ? (
          <img src={fileDownloadUrl(photo.id)} alt="Profile" className="h-full w-full object-cover" />
        ) : (
          patientName.charAt(0).toUpperCase()
        )}
      </div>
      <div>
        <Label htmlFor="profilePhoto">{photo ? "Replace profile picture" : "Add profile picture"}</Label>
        <input
          id="profilePhoto"
          type="file"
          accept=".jpg,.jpeg,.png,.webp,.heic"
          onChange={(e) => void onFileChosen(e)}
        />
        {upload.isPending && <p className="mt-1 text-xs text-slate-400">Uploading…</p>}
        <FieldError>{error}</FieldError>
      </div>
    </div>
  );
}

function ToothChartTab({ patientId, onNext }: { patientId: string; onNext: (teeth: string[]) => void }) {
  const { data: chart, isLoading } = usePatientToothChart(patientId);
  // Local to this tab: it remounts (and so resets) whenever the user leaves
  // and comes back to "Tooth chart", which is the reset behavior we want -
  // a fresh pick each time, never a stale selection from a previous visit.
  const [selectedTeeth, setSelectedTeeth] = useState<Set<string>>(new Set());

  function toggleTooth(tooth: string) {
    setSelectedTeeth((prev) => {
      const next = new Set(prev);
      if (next.has(tooth)) next.delete(tooth);
      else next.add(tooth);
      return next;
    });
  }

  return (
    <Card>
      {isLoading && <p className="text-sm text-slate-400">Loading…</p>}
      {chart && <ToothChart entries={chart} selectedTeeth={selectedTeeth} onToggleTooth={toggleTooth} />}
      <div className="mt-4 flex items-center justify-between gap-3">
        <p className="text-xs text-slate-400">
          Tap the teeth you're about to treat, then Next - one treatment note can cover several teeth at once.
        </p>
        <Button size="sm" disabled={selectedTeeth.size === 0} onClick={() => onNext(Array.from(selectedTeeth))}>
          Next{selectedTeeth.size > 0 ? ` (${selectedTeeth.size})` : ""}
        </Button>
      </div>
    </Card>
  );
}

function TreatmentsTab({
  patientId,
  prefillTeeth,
  onPrefillConsumed,
}: {
  patientId: string;
  prefillTeeth: string[];
  onPrefillConsumed: () => void;
}) {
  const { user } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const { data: treatments, isLoading } = useTreatmentsList(patientId);
  const createTreatment = useCreateTreatmentRecord(patientId);
  // Dr.Sri Sushma leads all treatment, so creating a note stays doctor-only.
  // Flipping a saved note's status is the one everyday edit a doctor still
  // makes to it; anything else about an already-saved note is admin-only
  // (see requireRole in treatments.ts) so a correction is always deliberate.
  const canCreate = user?.role === "doctor";
  const canToggleStatus = user?.role === "doctor" || user?.role === "admin";
  const canEdit = user?.role === "admin";

  // Arriving here via the chart's Next button (prefillTeeth set) should open
  // the form immediately, pre-filled with those teeth, rather than just
  // landing on a tab with no indication of which teeth were picked or how to
  // record them. Only for whoever can actually create one - otherwise this
  // would open a form that just 403s on submit.
  useEffect(() => {
    if (prefillTeeth.length > 0 && canCreate) setShowForm(true);
  }, [prefillTeeth, canCreate]);

  function closeForm() {
    setShowForm(false);
    onPrefillConsumed();
  }

  return (
    <div className="space-y-4">
      {canCreate && (
        <div className="flex justify-end">
          <Button size="sm" onClick={() => (showForm ? closeForm() : setShowForm(true))}>
            {showForm ? "Close" : "+ Add treatment note"}
          </Button>
        </div>
      )}
      {showForm && (
        <TreatmentForm
          patientId={patientId}
          staffId={user!.id}
          initialTeeth={prefillTeeth}
          onSaved={closeForm}
          mutate={createTreatment}
        />
      )}
      <Card>
        {isLoading && <p className="text-sm text-slate-400">Loading…</p>}
        {!isLoading && treatments?.length === 0 && <EmptyState>No treatment notes yet.</EmptyState>}
        <ul className="divide-y divide-slate-100">
          {treatments?.map((t) => (
            <TreatmentRow
              key={t.id}
              patientId={patientId}
              treatment={t}
              canToggleStatus={canToggleStatus}
              canEdit={canEdit}
            />
          ))}
        </ul>
      </Card>
    </div>
  );
}

function TreatmentRow({
  patientId,
  treatment,
  canToggleStatus,
  canEdit,
}: {
  patientId: string;
  treatment: TreatmentRecord;
  canToggleStatus: boolean;
  canEdit: boolean;
}) {
  const updateStatus = useUpdateTreatmentStatus(patientId, treatment.id);
  const [editing, setEditing] = useState(false);
  const otherStatus = treatment.status === "planned" ? "completed" : "planned";

  return (
    <li className="py-3 text-sm">
      <div className="flex items-center justify-between gap-3">
        <p className="font-medium text-slate-900">
          {treatment.procedure} {treatment.toothNumber && <span className="text-slate-400">· Tooth {treatment.toothNumber}</span>}
        </p>
        <div className="flex shrink-0 items-center gap-2">
          <Badge tone={treatment.status === "planned" ? "amber" : "green"}>{treatment.status}</Badge>
          {canToggleStatus && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => updateStatus.mutate({ status: otherStatus })}
              disabled={updateStatus.isPending}
            >
              Mark {otherStatus}
            </Button>
          )}
          {canEdit && (
            <Button size="sm" variant="secondary" onClick={() => setEditing((v) => !v)}>
              {editing ? "Close" : "Edit"}
            </Button>
          )}
        </div>
      </div>
      <p className="text-xs text-slate-400">{formatDate(treatment.date)}</p>
      {treatment.condition && (
        <p className="mt-1 text-slate-600">
          <span className="font-medium">Condition:</span>{" "}
          {treatment.condition === "other"
            ? `Other — ${treatment.conditionOther}`
            : treatment.condition.replace(/_/g, " ")}
        </p>
      )}
      {treatment.notes && <p className="mt-1 text-slate-600">{treatment.notes}</p>}
      {treatment.prescription && (
        <p className="mt-1 text-slate-600">
          <span className="font-medium">Prescription:</span> {treatment.prescription}
        </p>
      )}
      {treatment.beforeTreatmentFileId && (
        // A real download (the server sends Content-Disposition: attachment),
        // not an inline view - no need for target="_blank" to avoid leaving
        // the app, since a download never navigates the tab anywhere.
        <a
          href={fileDownloadUrl(treatment.beforeTreatmentFileId)}
          className="mt-1 inline-block text-brand-700 hover:underline"
        >
          Download before-treatment photo
        </a>
      )}
      {canEdit && editing && (
        <TreatmentEditForm patientId={patientId} treatment={treatment} onSaved={() => setEditing(false)} />
      )}
    </li>
  );
}

function TreatmentEditForm({
  patientId,
  treatment,
  onSaved,
}: {
  patientId: string;
  treatment: TreatmentRecord;
  onSaved: () => void;
}) {
  const updateTreatment = useUpdateTreatmentRecord(patientId, treatment.id);
  const [form, setForm] = useState({
    procedure: treatment.procedure,
    date: treatment.date,
    toothNumber: treatment.toothNumber ?? "",
    condition: treatment.condition ?? "",
    conditionOther: treatment.conditionOther ?? "",
    notes: treatment.notes ?? "",
    prescription: treatment.prescription ?? "",
  });
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.procedure.trim()) {
      setError("Describe the procedure.");
      return;
    }
    if (!form.condition) {
      setError("Select the tooth condition.");
      return;
    }
    if (form.condition === "other" && !form.conditionOther.trim()) {
      setError("Describe the condition.");
      return;
    }
    try {
      await updateTreatment.mutateAsync({
        procedure: form.procedure,
        date: form.date,
        toothNumber: (form.toothNumber || undefined) as never,
        condition: form.condition as never,
        conditionOther: form.condition === "other" ? form.conditionOther.trim() : undefined,
        notes: form.notes || undefined,
        prescription: form.prescription || undefined,
      });
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save the changes.");
    }
  }

  return (
    <Card className="mt-2">
      <form onSubmit={onSubmit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor={`edit-procedure-${treatment.id}`}>Procedure</Label>
            <Input
              id={`edit-procedure-${treatment.id}`}
              value={form.procedure}
              onChange={(e) => setForm((f) => ({ ...f, procedure: e.target.value }))}
            />
          </div>
          <div>
            <Label htmlFor={`edit-date-${treatment.id}`}>Date</Label>
            <Input
              id={`edit-date-${treatment.id}`}
              type="date"
              value={form.date}
              onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor={`edit-tooth-${treatment.id}`}>Tooth (optional)</Label>
            <Input
              id={`edit-tooth-${treatment.id}`}
              value={form.toothNumber}
              onChange={(e) => setForm((f) => ({ ...f, toothNumber: e.target.value }))}
            />
          </div>
          <div>
            <Label htmlFor={`edit-condition-${treatment.id}`}>Tooth condition</Label>
            <Select
              id={`edit-condition-${treatment.id}`}
              value={form.condition}
              onChange={(e) => setForm((f) => ({ ...f, condition: e.target.value }))}
            >
              <option value="" disabled>
                Select condition…
              </option>
              {TOOTH_CONDITIONS.map((c) => (
                <option key={c} value={c}>
                  {c.replace(/_/g, " ")}
                </option>
              ))}
            </Select>
          </div>
        </div>
        {form.condition === "other" && (
          <div>
            <Label htmlFor={`edit-condition-other-${treatment.id}`}>Describe condition</Label>
            <Input
              id={`edit-condition-other-${treatment.id}`}
              value={form.conditionOther}
              onChange={(e) => setForm((f) => ({ ...f, conditionOther: e.target.value }))}
              placeholder="e.g. Chipped enamel, cosmetic wear"
            />
          </div>
        )}
        <div>
          <Label htmlFor={`edit-notes-${treatment.id}`}>Notes (optional)</Label>
          <Textarea
            id={`edit-notes-${treatment.id}`}
            rows={2}
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
          />
        </div>
        <div>
          <Label htmlFor={`edit-prescription-${treatment.id}`}>Prescription (optional)</Label>
          <Textarea
            id={`edit-prescription-${treatment.id}`}
            rows={2}
            value={form.prescription}
            onChange={(e) => setForm((f) => ({ ...f, prescription: e.target.value }))}
          />
        </div>
        <FieldError>{error}</FieldError>
        <Button type="submit" disabled={updateTreatment.isPending}>
          {updateTreatment.isPending ? "Saving…" : "Save changes"}
        </Button>
      </form>
    </Card>
  );
}

function TreatmentForm({
  patientId,
  staffId,
  initialTeeth,
  onSaved,
  mutate,
}: {
  patientId: string;
  staffId: string;
  /** Teeth picked on the chart before landing here (see ToothChartTab's Next button) - one record is created per tooth, sharing everything else in the form. */
  initialTeeth?: string[];
  onSaved: () => void;
  mutate: ReturnType<typeof useCreateTreatmentRecord>;
}) {
  const navigate = useNavigate();
  const uploadPhoto = useUploadFile();
  const hasInitialTeeth = !!initialTeeth?.length;
  const [form, setForm] = useState<Partial<CreateTreatmentRecordInput>>({
    date: todayDateInputValue(),
    status: "completed",
  });
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.procedure) {
      setError("Describe the procedure.");
      return;
    }
    if (!form.condition) {
      setError("Select the tooth condition.");
      return;
    }
    if (form.condition === "other" && !form.conditionOther?.trim()) {
      setError("Describe the condition.");
      return;
    }
    if (!photoFile) {
      setError("Add a before-treatment photo.");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const uploaded = await uploadPhoto.mutateAsync({
        patientId,
        type: "before_treatment",
        file: await compressImageForUpload(photoFile),
      });
      const base = {
        ...form,
        patientId,
        staffId,
        procedure: form.procedure,
        condition: form.condition,
        conditionOther: form.condition === "other" ? form.conditionOther?.trim() : undefined,
        date: form.date!,
        status: form.status ?? "completed",
        beforeTreatmentFileId: uploaded.item.id,
      };
      // One treatment record per selected tooth, sequentially - each is an
      // independent POST, so a failure partway through leaves the earlier
      // teeth saved rather than losing the whole batch.
      const teeth = hasInitialTeeth ? initialTeeth! : [form.toothNumber];
      for (const tooth of teeth) {
        await mutate.mutateAsync({ ...base, toothNumber: tooth as never });
      }
      // A "planned" treatment needs a booked visit to actually happen, so go
      // straight to scheduling one instead of just closing the form.
      if (form.status === "planned") {
        navigate(`/appointments/new?patientId=${patientId}`);
        return;
      }
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save.");
    } finally {
      setSaving(false);
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
            <Label htmlFor="tooth">Tooth{hasInitialTeeth ? "" : " (optional)"}</Label>
            {hasInitialTeeth ? (
              <div id="tooth" className="flex flex-wrap items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <span className="text-sm text-slate-600">{initialTeeth!.length > 1 ? "Teeth" : "Tooth"}:</span>
                {initialTeeth!.map((tooth) => (
                  <Badge key={tooth} tone="brand">
                    {tooth}
                  </Badge>
                ))}
                <span className="text-xs text-slate-400">· selected from the chart</span>
              </div>
            ) : (
              <Input
                id="tooth"
                placeholder="e.g. 16"
                value={form.toothNumber ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, toothNumber: e.target.value || undefined }))}
              />
            )}
          </div>
          <div>
            <Label htmlFor="condition">Tooth condition</Label>
            <Select
              id="condition"
              value={form.condition ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, condition: e.target.value as never }))}
            >
              <option value="" disabled>
                Select condition…
              </option>
              {TOOTH_CONDITIONS.map((c) => (
                <option key={c} value={c}>
                  {c.replace(/_/g, " ")}
                </option>
              ))}
            </Select>
          </div>
        </div>
        {form.condition === "other" && (
          <div>
            <Label htmlFor="conditionOther">Describe condition</Label>
            <Input
              id="conditionOther"
              value={form.conditionOther ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, conditionOther: e.target.value }))}
              placeholder="e.g. Chipped enamel, cosmetic wear"
            />
          </div>
        )}
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
        <div>
          <Label htmlFor="beforePhoto">Before-treatment photo</Label>
          <input
            id="beforePhoto"
            type="file"
            accept=".jpg,.jpeg,.png,.webp,.heic"
            onChange={(e) => setPhotoFile(e.target.files?.[0] ?? null)}
          />
          {photoFile && <p className="mt-1 text-xs text-slate-500">{photoFile.name}</p>}
        </div>
        <FieldError>{error}</FieldError>
        <Button type="submit" disabled={saving}>
          {uploadPhoto.isPending
            ? "Uploading photo…"
            : saving
              ? initialTeeth && initialTeeth.length > 1
                ? "Saving treatment notes…"
                : "Saving…"
              : initialTeeth && initialTeeth.length > 1
                ? `Save treatment note for ${initialTeeth.length} teeth`
                : "Save treatment note"}
        </Button>
      </form>
    </Card>
  );
}

function FilesTab({ patientId }: { patientId: string }) {
  const { user } = useAuth();
  const { data: files, isLoading } = useFilesList(patientId);
  const upload = useUploadFile();
  const deleteFile = useDeleteFile(patientId);
  const [type, setType] = useState<"xray" | "photo" | "document" | "other">("xray");
  const [error, setError] = useState<string | null>(null);
  const canDelete = user?.role === "admin";

  async function onFileChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    try {
      await upload.mutateAsync({ patientId, type, file: await compressImageForUpload(file) });
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
                <p className="font-medium text-slate-900">{f.fileName}</p>
                <p className="text-xs text-slate-400">
                  {f.type} · {formatDateTime(f.uploadedAt)} · {Math.round(f.sizeBytes / 1024)} KB
                </p>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={fileDownloadUrl(f.id)}
                  className="inline-flex items-center justify-center rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  Download
                </a>
                {canDelete && (
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => {
                      if (confirm(`Delete "${f.fileName}"? This can't be undone from here.`)) {
                        deleteFile.mutate(f.id);
                      }
                    }}
                    disabled={deleteFile.isPending}
                  >
                    Delete
                  </Button>
                )}
              </div>
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
                  <p className="text-xs text-slate-400">{formatDateTime(invoice.date)}</p>
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
