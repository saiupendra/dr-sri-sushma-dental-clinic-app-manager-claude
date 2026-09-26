import { useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { FILE_TYPES, TOOTH_CONDITIONS, type FileType, type TreatmentRecord } from "@clinic/shared";
import { useDeletePatient, usePatient, usePatientToothChart } from "../../hooks/usePatients.js";
import {
  useCompleteTreatmentRecord,
  useCreateTreatmentRecord,
  useDeleteTreatmentRecord,
  useTreatmentsList,
  useUpdateTreatmentRecord,
} from "../../hooks/useTreatments.js";
import { useAppointmentsList } from "../../hooks/useAppointments.js";
import { useDeleteFile, useFilesList, useUploadFile, fileDownloadUrl } from "../../hooks/useFiles.js";
import { useDeleteInvoice, useInvoicesList } from "../../hooks/useInvoices.js";
import { useAuth } from "../../auth/useAuth.js";
import { ToothChart } from "../../components/ToothChart.js";
import { formatDate, formatDateTime, todayDateInputValue } from "../../lib/dates.js";
import { compressImageForUpload } from "../../lib/imageCompression.js";
import { ApiError } from "../../api/client.js";
import { Badge, Button, Card, EmptyState, FieldError, Input, Label, Modal, PageHeader, Select, Textarea } from "../../components/ui.js";

type Tab = "overview" | "chart" | "treatments" | "files" | "billing";
const TAB_VALUES: Tab[] = ["overview", "chart", "treatments", "files", "billing"];

export function PatientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  // Lets a link from elsewhere (e.g. an appointment) land directly on a tab,
  // for example /patients/:id?tab=treatments.
  const requestedTab = searchParams.get("tab");
  const initialTab: Tab = TAB_VALUES.includes(requestedTab as Tab) ? (requestedTab as Tab) : "overview";
  const [tab, setTab] = useState<Tab>(initialTab);
  const [prefillTeeth, setPrefillTeeth] = useState<string[]>([]);
  const { data: patient, isLoading } = usePatient(id);
  const deletePatient = useDeletePatient(id ?? "");
  const [deleteError, setDeleteError] = useState<string | null>(null);

  if (isLoading) return <p className="text-sm text-slate-400">Loading…</p>;
  if (!patient) return <p className="text-sm text-slate-500">Patient not found.</p>;

  async function onDeletePatient() {
    setDeleteError(null);
    if (!confirm(`Delete ${patient!.name}'s record? This can't be undone.`)) return;
    try {
      await deletePatient.mutateAsync();
      navigate("/patients");
    } catch (err) {
      setDeleteError(err instanceof ApiError ? err.message : "Could not delete the patient.");
    }
  }

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
          {user?.role === "admin" && (
            <Card className="border-red-200">
              <h2 className="text-sm font-semibold text-red-800">Danger zone</h2>
              <p className="mt-1 text-sm text-slate-500">
                Permanently removes this patient from lists and search. Their appointments, treatment notes and
                invoices stay on record but the patient can no longer be found or billed.
              </p>
              <Button
                type="button"
                variant="danger"
                className="mt-3"
                onClick={() => void onDeletePatient()}
                disabled={deletePatient.isPending}
              >
                {deletePatient.isPending ? "Deleting…" : "Delete patient"}
              </Button>
              <FieldError>{deleteError}</FieldError>
            </Card>
          )}
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
  // Completing a saved note is the one everyday edit a doctor still makes to
  // it (see TreatmentRow's "Mark completed" flow); anything else about an
  // already-saved note is admin-only (see requireRole in treatments.ts) so a
  // correction is always deliberate.
  const canCreate = user?.role === "doctor";
  const canComplete = user?.role === "doctor" || user?.role === "admin";
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
              canComplete={canComplete}
              canEdit={canEdit}
              canDelete={user?.role === "admin"}
            />
          ))}
        </ul>
      </Card>
    </div>
  );
}

/** Thumbnail grid for a treatment's photos - clicking one downloads it. */
function PhotoThumbnails({ fileIds }: { fileIds: string[] }) {
  if (fileIds.length === 0) return null;
  return (
    <div className="mt-1 flex flex-wrap gap-2">
      {fileIds.map((fileId) => (
        <a key={fileId} href={fileDownloadUrl(fileId)} className="block h-16 w-16 overflow-hidden rounded-lg border border-slate-200">
          <img src={fileDownloadUrl(fileId)} alt="Treatment photo" className="h-full w-full object-cover" />
        </a>
      ))}
    </div>
  );
}

function TreatmentRow({
  patientId,
  treatment,
  canComplete,
  canEdit,
  canDelete,
}: {
  patientId: string;
  treatment: TreatmentRecord;
  canComplete: boolean;
  canEdit: boolean;
  canDelete: boolean;
}) {
  const deleteTreatment = useDeleteTreatmentRecord(patientId, treatment.id);
  const [editing, setEditing] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  function onDelete() {
    setDeleteError(null);
    if (!confirm(`Delete this treatment note (${treatment.procedure})? This can't be undone.`)) return;
    deleteTreatment.mutate(undefined, {
      onError: (err) => setDeleteError(err instanceof ApiError ? err.message : "Could not delete the treatment note."),
    });
  }

  return (
    <li className="py-3 text-sm">
      <div className="flex items-center justify-between gap-3">
        <p className="font-medium text-slate-900">
          {treatment.procedure} {treatment.toothNumber && <span className="text-slate-400">· Tooth {treatment.toothNumber}</span>}
        </p>
        <div className="flex shrink-0 items-center gap-2">
          <Badge tone={treatment.status === "planned" ? "amber" : "green"}>{treatment.status}</Badge>
          {/* Completing is one-way - see PATCH /:id/complete in treatments.ts - so this only ever shows while still planned. */}
          {canComplete && treatment.status === "planned" && (
            <Button size="sm" variant="secondary" onClick={() => setCompleting(true)}>
              Mark completed
            </Button>
          )}
          {canEdit && (
            <Button size="sm" variant="secondary" onClick={() => setEditing((v) => !v)}>
              {editing ? "Close" : "Edit"}
            </Button>
          )}
          {canDelete && (
            <Button size="sm" variant="danger" onClick={onDelete} disabled={deleteTreatment.isPending}>
              Delete
            </Button>
          )}
        </div>
      </div>
      <FieldError>{deleteError}</FieldError>
      <p className="text-xs text-slate-400">
        Planned {formatDate(treatment.date)}
        {treatment.completedDate && ` · Completed ${formatDate(treatment.completedDate)}`}
      </p>
      {treatment.condition && (
        <p className="mt-1 text-slate-600">
          <span className="font-medium">Condition:</span>{" "}
          {treatment.condition === "other"
            ? `Other — ${treatment.conditionOther}`
            : treatment.condition.replace(/_/g, " ")}
        </p>
      )}
      {treatment.notes && (
        <p className="mt-1 text-slate-600">
          <span className="font-medium">Pre-op notes:</span> {treatment.notes}
        </p>
      )}
      {treatment.prescription && (
        <p className="mt-1 text-slate-600">
          <span className="font-medium">Prescription:</span> {treatment.prescription}
        </p>
      )}
      {treatment.beforeTreatmentFileIds.length > 0 && (
        <div className="mt-2">
          <p className="text-xs font-medium text-slate-500">Pre-operative photos</p>
          <PhotoThumbnails fileIds={treatment.beforeTreatmentFileIds} />
        </div>
      )}
      {treatment.postTreatmentNotes && (
        <p className="mt-2 text-slate-600">
          <span className="font-medium">Post-op notes:</span> {treatment.postTreatmentNotes}
        </p>
      )}
      {treatment.afterTreatmentFileIds.length > 0 && (
        <div className="mt-2">
          <p className="text-xs font-medium text-slate-500">Post-operative photos</p>
          <PhotoThumbnails fileIds={treatment.afterTreatmentFileIds} />
        </div>
      )}
      {canEdit && editing && (
        <TreatmentEditForm patientId={patientId} treatment={treatment} onSaved={() => setEditing(false)} />
      )}
      {completing && (
        <MarkCompletedModal patientId={patientId} treatment={treatment} onClose={() => setCompleting(false)} />
      )}
    </li>
  );
}

function MarkCompletedModal({
  patientId,
  treatment,
  onClose,
}: {
  patientId: string;
  treatment: TreatmentRecord;
  onClose: () => void;
}) {
  const uploadPhoto = useUploadFile();
  const complete = useCompleteTreatmentRecord(patientId, treatment.id);
  const [completedDate, setCompletedDate] = useState(todayDateInputValue());
  const [postTreatmentNotes, setPostTreatmentNotes] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!completedDate) {
      setError("Set the date the treatment was done.");
      return;
    }
    if (!postTreatmentNotes.trim()) {
      setError("Add post-operative notes.");
      return;
    }
    if (photos.length === 0) {
      setError("Add at least one post-operative photo.");
      return;
    }
    setError(null);
    try {
      const afterTreatmentFileIds: string[] = [];
      for (const [index, file] of photos.entries()) {
        setProgress(`Uploading photo ${index + 1}/${photos.length}…`);
        const uploaded = await uploadPhoto.mutateAsync({
          patientId,
          type: "after_treatment",
          file: await compressImageForUpload(file),
        });
        afterTreatmentFileIds.push(uploaded.item.id);
      }
      setProgress("Saving…");
      await complete.mutateAsync({ completedDate, postTreatmentNotes: postTreatmentNotes.trim(), afterTreatmentFileIds });
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not mark this treatment completed.");
    } finally {
      setProgress(null);
    }
  }

  return (
    <Modal title={`Mark "${treatment.procedure}" completed`} onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-3">
        <p className="text-sm text-slate-600">
          Once marked completed, this can&apos;t be reverted back to planned - double-check the details below.
        </p>
        <div>
          <Label htmlFor="completedDate">Treatment done date</Label>
          <Input
            id="completedDate"
            type="date"
            value={completedDate}
            max={todayDateInputValue()}
            onChange={(e) => setCompletedDate(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="postTreatmentNotes">Post-operative notes</Label>
          <Textarea
            id="postTreatmentNotes"
            rows={3}
            value={postTreatmentNotes}
            onChange={(e) => setPostTreatmentNotes(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="postPhotos">Post Operative Photos</Label>
          <input
            id="postPhotos"
            type="file"
            multiple
            accept=".jpg,.jpeg,.png,.webp,.heic"
            onChange={(e) => setPhotos(Array.from(e.target.files ?? []))}
          />
          {photos.length > 0 && (
            <p className="mt-1 text-xs text-slate-500">
              {photos.length} photo{photos.length === 1 ? "" : "s"} selected
            </p>
          )}
        </div>
        <FieldError>{error}</FieldError>
        <div className="flex gap-2">
          <Button type="submit" disabled={complete.isPending}>
            {complete.isPending ? (progress ?? "Saving…") : "Save completion"}
          </Button>
          <Button type="button" variant="secondary" onClick={onClose} disabled={complete.isPending}>
            Cancel
          </Button>
        </div>
      </form>
    </Modal>
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
    if (!form.notes.trim()) {
      setError("Add treatment notes.");
      return;
    }
    if (!form.prescription.trim()) {
      setError("Add a prescription.");
      return;
    }
    try {
      await updateTreatment.mutateAsync({
        procedure: form.procedure,
        date: form.date,
        toothNumber: (form.toothNumber || undefined) as never,
        condition: form.condition as never,
        conditionOther: form.condition === "other" ? form.conditionOther.trim() : undefined,
        notes: form.notes.trim(),
        prescription: form.prescription.trim(),
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
          <Label htmlFor={`edit-notes-${treatment.id}`}>Notes</Label>
          <Textarea
            id={`edit-notes-${treatment.id}`}
            rows={2}
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
          />
        </div>
        <div>
          <Label htmlFor={`edit-prescription-${treatment.id}`}>Prescription</Label>
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

interface ToothEntry {
  tooth: string;
  condition: string;
  conditionOther: string;
  notes: string;
  photos: File[];
}

/**
 * One tooth's condition/notes/photos. `editableTooth` (the manual,
 * non-chart path) uses a fixed id suffix ("manual") so the field ids never
 * shift as the user types a tooth number - `fixedTooth` (the chart path)
 * uses the tooth number itself, which never changes after the row is created.
 */
function ToothRow({
  row,
  editableTooth,
  onChange,
}: {
  row: ToothEntry;
  editableTooth: boolean;
  onChange: (patch: Partial<ToothEntry>) => void;
}) {
  const idSuffix = editableTooth ? "" : `-${row.tooth}`;
  return (
    <div className="rounded-lg border border-slate-200 p-3">
      {editableTooth ? (
        <div>
          <Label htmlFor="tooth">Tooth (optional)</Label>
          <Input id="tooth" placeholder="e.g. 16" value={row.tooth} onChange={(e) => onChange({ tooth: e.target.value })} />
        </div>
      ) : (
        <Badge tone="brand">Tooth {row.tooth}</Badge>
      )}
      <div className="mt-2 grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor={`condition${idSuffix}`}>Tooth condition</Label>
          <Select
            id={`condition${idSuffix}`}
            value={row.condition}
            onChange={(e) => onChange({ condition: e.target.value })}
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
        {row.condition === "other" && (
          <div>
            <Label htmlFor={`conditionOther${idSuffix}`}>Describe condition</Label>
            <Input
              id={`conditionOther${idSuffix}`}
              value={row.conditionOther}
              onChange={(e) => onChange({ conditionOther: e.target.value })}
              placeholder="e.g. Chipped enamel, cosmetic wear"
            />
          </div>
        )}
      </div>
      <div className="mt-2">
        <Label htmlFor={`notes${idSuffix}`}>Notes</Label>
        <Textarea id={`notes${idSuffix}`} rows={2} value={row.notes} onChange={(e) => onChange({ notes: e.target.value })} />
      </div>
      <div className="mt-2">
        <Label htmlFor={`beforePhoto${idSuffix}`}>Pre Operative Photos</Label>
        <input
          id={`beforePhoto${idSuffix}`}
          type="file"
          multiple
          accept=".jpg,.jpeg,.png,.webp,.heic"
          onChange={(e) => onChange({ photos: Array.from(e.target.files ?? []) })}
        />
        {row.photos.length > 0 && (
          <p className="mt-1 text-xs text-slate-500">
            {row.photos.length} photo{row.photos.length === 1 ? "" : "s"} selected
          </p>
        )}
      </div>
    </div>
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
  /** Teeth picked on the chart before landing here (see ToothChartTab's Next button) - one record is created per tooth, each with its own condition/notes/photos. */
  initialTeeth?: string[];
  onSaved: () => void;
  mutate: ReturnType<typeof useCreateTreatmentRecord>;
}) {
  const navigate = useNavigate();
  const uploadPhoto = useUploadFile();
  const hasInitialTeeth = !!initialTeeth?.length;
  const { data: patientAppointments } = useAppointmentsList({ patientId });
  // Only appointments still ahead of us are worth linking a planned
  // treatment to - a completed/cancelled/no-show one is history, not a slot
  // this note's work can still happen in.
  const linkableAppointments = (patientAppointments ?? [])
    .filter((a) => a.status === "scheduled" || a.status === "confirmed")
    .sort((a, b) => a.startAt.localeCompare(b.startAt));

  const [procedure, setProcedure] = useState("");
  const [prescription, setPrescription] = useState("");
  const [appointmentId, setAppointmentId] = useState("");
  const [rows, setRows] = useState<ToothEntry[]>(() =>
    hasInitialTeeth
      ? initialTeeth!.map((tooth) => ({ tooth, condition: "", conditionOther: "", notes: "", photos: [] }))
      : [{ tooth: "", condition: "", conditionOther: "", notes: "", photos: [] }],
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);

  function updateRow(index: number, patch: Partial<ToothEntry>) {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmedProcedure = procedure.trim();
    const trimmedPrescription = prescription.trim();
    if (!trimmedProcedure) {
      setError("Describe the procedure.");
      return;
    }
    if (!trimmedPrescription) {
      setError("Add a prescription.");
      return;
    }
    for (const row of rows) {
      if (!row.condition) {
        setError("Select the tooth condition for every tooth.");
        return;
      }
      if (row.condition === "other" && !row.conditionOther.trim()) {
        setError("Describe the condition for every tooth marked \"Other\".");
        return;
      }
      if (!row.notes.trim()) {
        setError("Add notes for every tooth.");
        return;
      }
      if (row.photos.length === 0) {
        setError("Add at least one pre-operative photo for every tooth.");
        return;
      }
    }
    setError(null);
    setSaving(true);
    try {
      // One treatment record per tooth, sequentially - a failure partway
      // through leaves the earlier teeth saved (and their photos uploaded)
      // rather than losing the whole batch.
      for (const [index, row] of rows.entries()) {
        const label = rows.length > 1 ? ` for tooth ${row.tooth} (${index + 1}/${rows.length})` : "";
        const beforeTreatmentFileIds: string[] = [];
        for (const [photoIndex, file] of row.photos.entries()) {
          setProgress(`Uploading photo ${photoIndex + 1}/${row.photos.length}${label}…`);
          const uploaded = await uploadPhoto.mutateAsync({
            patientId,
            type: "before_treatment",
            file: await compressImageForUpload(file),
          });
          beforeTreatmentFileIds.push(uploaded.item.id);
        }
        setProgress(`Saving${label}…`);
        await mutate.mutateAsync({
          patientId,
          staffId,
          appointmentId: appointmentId || undefined,
          procedure: trimmedProcedure,
          prescription: trimmedPrescription,
          toothNumber: (row.tooth || undefined) as never,
          condition: row.condition as never,
          conditionOther: row.condition === "other" ? row.conditionOther.trim() : undefined,
          notes: row.notes.trim(),
          beforeTreatmentFileIds,
        });
      }
      // A planned treatment with no appointment linked yet needs one booked
      // to actually happen, so go straight to scheduling one instead of just
      // closing the form. Already linked to one? It's already booked.
      if (!appointmentId) {
        navigate(`/appointments/new?patientId=${patientId}`);
        return;
      }
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save.");
    } finally {
      setSaving(false);
      setProgress(null);
    }
  }

  return (
    <Card>
      <form onSubmit={onSubmit} className="space-y-3">
        <div>
          <Label htmlFor="procedure">Procedure</Label>
          <Input id="procedure" value={procedure} onChange={(e) => setProcedure(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="appointment">Link to existing appointment</Label>
          <Select id="appointment" value={appointmentId} onChange={(e) => setAppointmentId(e.target.value)}>
            <option value="">No linked appointment</option>
            {linkableAppointments.map((a) => (
              <option key={a.id} value={a.id}>
                {formatDateTime(a.startAt)}
                {a.reasonNote ? ` · ${a.reasonNote}` : ""}
              </option>
            ))}
          </Select>
          <p className="mt-1 text-xs text-slate-400">
            {linkableAppointments.length === 0
              ? "This patient has no scheduled appointments yet."
              : `${linkableAppointments.length} scheduled appointment${linkableAppointments.length === 1 ? "" : "s"} for this patient.`}
          </p>
        </div>
        <div>
          <Label htmlFor="prescription">Prescription</Label>
          <Textarea id="prescription" rows={2} value={prescription} onChange={(e) => setPrescription(e.target.value)} />
        </div>
        <div className="space-y-3">
          <Label>{hasInitialTeeth ? `Teeth (${rows.length})` : "Tooth"}</Label>
          {rows.map((row, index) => (
            <ToothRow
              key={hasInitialTeeth ? row.tooth : "manual"}
              row={row}
              editableTooth={!hasInitialTeeth}
              onChange={(patch) => updateRow(index, patch)}
            />
          ))}
        </div>
        <FieldError>{error}</FieldError>
        <Button type="submit" disabled={saving}>
          {saving
            ? (progress ?? "Saving…")
            : hasInitialTeeth && rows.length > 1
              ? `Save treatment note for ${rows.length} teeth`
              : "Save treatment note"}
        </Button>
      </form>
    </Card>
  );
}

function FileTypeBadgeLabel(type: FileType): string {
  return type.replace(/_/g, " ");
}

const UPLOADABLE_FILE_TYPES: FileType[] = FILE_TYPES.filter(
  (t) => t !== "profile_photo" && t !== "before_treatment" && t !== "after_treatment",
);

function FilePreview({ file }: { file: { id: string; mimeType: string; fileName: string } }) {
  if (file.mimeType.startsWith("image/")) {
    return (
      <a href={fileDownloadUrl(file.id)} className="block h-28 w-full overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
        <img src={fileDownloadUrl(file.id)} alt={file.fileName} className="h-full w-full object-cover" />
      </a>
    );
  }
  return (
    <a
      href={fileDownloadUrl(file.id)}
      className="flex h-28 w-full flex-col items-center justify-center gap-1 rounded-lg border border-slate-200 bg-slate-50 text-slate-400"
    >
      <span className="text-xs font-semibold uppercase tracking-wide">PDF</span>
      <span className="max-w-[90%] truncate text-[10px] text-slate-400">{file.fileName}</span>
    </a>
  );
}

function FilesTab({ patientId }: { patientId: string }) {
  const { user } = useAuth();
  const { data: files, isLoading } = useFilesList(patientId);
  const upload = useUploadFile();
  const deleteFile = useDeleteFile(patientId);
  const [type, setType] = useState<FileType>("xray");
  const [otherLabel, setOtherLabel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const canDelete = user?.role === "admin";

  async function onFileChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (type === "other" && !otherLabel.trim()) {
      setError("Describe what this file is.");
      e.target.value = "";
      return;
    }
    setError(null);
    try {
      await upload.mutateAsync({
        patientId,
        type,
        notes: type === "other" ? otherLabel.trim() : undefined,
        file: await compressImageForUpload(file),
      });
      setOtherLabel("");
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
            <Select id="fileType" value={type} onChange={(e) => setType(e.target.value as FileType)}>
              {UPLOADABLE_FILE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {FileTypeBadgeLabel(t)}
                </option>
              ))}
            </Select>
          </div>
          {type === "other" && (
            <div>
              <Label htmlFor="otherLabel">Describe this file</Label>
              <Input
                id="otherLabel"
                placeholder="e.g. Referral letter"
                value={otherLabel}
                onChange={(e) => setOtherLabel(e.target.value)}
              />
            </div>
          )}
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
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
          {files?.map((f) => (
            <div key={f.id} className="space-y-1.5">
              <FilePreview file={f} />
              <p className="text-xs text-slate-500">
                {f.type === "other" && f.notes ? f.notes : FileTypeBadgeLabel(f.type)}
              </p>
              <p className="text-[11px] text-slate-400">
                {formatDateTime(f.uploadedAt)} · {Math.round(f.sizeBytes / 1024)} KB
              </p>
              <div className="flex items-center gap-2">
                <a href={fileDownloadUrl(f.id)} className="text-xs font-medium text-brand-700 hover:underline">
                  Download
                </a>
                {canDelete && (
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm(`Delete "${f.fileName}"? This can't be undone from here.`)) {
                        deleteFile.mutate(f.id);
                      }
                    }}
                    disabled={deleteFile.isPending}
                    className="text-xs font-medium text-red-600 hover:underline disabled:opacity-50"
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function BillingTab({ patientId }: { patientId: string }) {
  const { user } = useAuth();
  const { data } = useInvoicesList(patientId);
  const isAdmin = user?.role === "admin";
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
            <PatientInvoiceRow key={invoice.id} invoice={invoice} canDelete={isAdmin} />
          ))}
        </ul>
      </Card>
    </div>
  );
}

function PatientInvoiceRow({
  invoice,
  canDelete,
}: {
  invoice: { id: string; totalAmount: number; date: string; status: string };
  canDelete: boolean;
}) {
  const deleteInvoice = useDeleteInvoice(invoice.id);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function onDelete() {
    setDeleteError(null);
    if (!confirm("Delete this invoice? This can't be undone.")) return;
    try {
      await deleteInvoice.mutateAsync();
    } catch (err) {
      setDeleteError(err instanceof ApiError ? err.message : "Could not delete the invoice.");
    }
  }

  return (
    <li className="py-3 text-sm">
      <div className="flex items-center justify-between gap-3">
        <Link to={`/billing/${invoice.id}`} className="flex-1 hover:underline">
          <p className="font-medium text-slate-900">₹{invoice.totalAmount.toFixed(2)}</p>
          <p className="text-xs text-slate-400">{formatDateTime(invoice.date)}</p>
        </Link>
        <Badge tone={invoice.status === "paid" ? "green" : invoice.status === "cancelled" ? "red" : "amber"}>
          {invoice.status.replace("_", " ")}
        </Badge>
        {canDelete && (
          <Button size="sm" variant="danger" onClick={() => void onDelete()} disabled={deleteInvoice.isPending}>
            Delete
          </Button>
        )}
      </div>
      <FieldError>{deleteError}</FieldError>
    </li>
  );
}
