import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  APPOINTMENT_STATUSES,
  APPOINTMENT_STATUSES_OFFERING_FOLLOWUP,
  type AppointmentStatus,
  type TreatmentRecord,
} from "@clinic/shared";
import { useAppointment, useCreateAppointment, useUpdateAppointment } from "../../hooks/useAppointments.js";
import { useStaffList } from "../../hooks/useStaff.js";
import { usePatient } from "../../hooks/usePatients.js";
import { useTreatmentsList } from "../../hooks/useTreatments.js";
import { PatientPicker, type PickedPatient } from "../../components/PatientPicker.js";
import { fromDatetimeLocalValue, toDatetimeLocalValue } from "../../lib/dates.js";
import { ApiError } from "../../api/client.js";
import { Button, Card, FieldError, Input, Label, Modal, PageHeader, Select, Textarea } from "../../components/ui.js";

const DEFAULT_DURATION_MINUTES = 30;

/** A short summary of a planned tooth's saved details, used to auto-fill the appointment's reason/notes. */
function summarizePlannedTreatment(t: TreatmentRecord): string {
  const lines = [
    `Tooth ${t.toothNumber ?? "—"} — ${t.procedure}`,
    t.condition ? `Condition: ${t.condition === "other" ? t.conditionOther : t.condition.replace(/_/g, " ")}` : null,
    t.notes ? `Notes: ${t.notes}` : null,
    t.prescription ? `Prescription: ${t.prescription}` : null,
  ];
  return lines.filter(Boolean).join("\n");
}

function nowDatetimeLocalValue(): string {
  return toDatetimeLocalValue(new Date().toISOString());
}

export function AppointmentFormPage() {
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedPatientId = searchParams.get("patientId") ?? undefined;
  const { data: preselectedPatient } = usePatient(!isEdit ? preselectedPatientId : undefined);
  const { data: existing } = useAppointment(id);
  const { data: staffList } = useStaffList();
  // Only a doctor is ever the clinician a patient is booked "with" - see
  // requireRole/assertStaffIsDoctor in routes/appointments.ts and the RBAC
  // table in docs/architecture.md.
  const bookableStaff = staffList?.filter((s) => s.role === "doctor");
  const createAppointment = useCreateAppointment();
  const updateAppointment = useUpdateAppointment(id ?? "");

  const [patient, setPatient] = useState<PickedPatient | null>(null);
  const effectivePatient =
    patient ?? (preselectedPatient ? { id: preselectedPatient.id, name: preselectedPatient.name, phone: preselectedPatient.phone } : null);
  const { data: plannedTreatments } = useTreatmentsList(!isEdit ? effectivePatient?.id : undefined);
  const plannedForTooth = (plannedTreatments ?? []).filter((t) => t.status === "planned");

  const [staffId, setStaffId] = useState("");
  const [start, setStart] = useState(() => {
    const d = new Date();
    d.setMinutes(Math.ceil(d.getMinutes() / 15) * 15, 0, 0);
    return toDatetimeLocalValue(d.toISOString());
  });
  const [durationMinutes, setDurationMinutes] = useState(DEFAULT_DURATION_MINUTES);
  const [status, setStatus] = useState<string>("scheduled");
  const [reasonNote, setReasonNote] = useState("");
  const [plannedTreatmentId, setPlannedTreatmentId] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Saving with status rescheduled/no_show/cancelled offers to book a
  // follow-up right away instead of leaving that as a separate step -
  // see APPOINTMENT_STATUSES_OFFERING_FOLLOWUP.
  const [followupPrompt, setFollowupPrompt] = useState(false);
  const [followupStart, setFollowupStart] = useState(nowDatetimeLocalValue());
  const [followupSaving, setFollowupSaving] = useState(false);
  const [followupError, setFollowupError] = useState<string | null>(null);

  useEffect(() => {
    if (!existing) return;
    setPatient({ id: existing.patientId, name: existing.patientName, phone: existing.patientPhone });
    setStaffId(existing.staffId);
    setStart(toDatetimeLocalValue(existing.startAt));
    setDurationMinutes(
      Math.round((new Date(existing.endAt).getTime() - new Date(existing.startAt).getTime()) / 60000),
    );
    setStatus(existing.status);
    setReasonNote(existing.reasonNote ?? "");
  }, [existing]);

  useEffect(() => {
    if (!staffId && bookableStaff && bookableStaff.length > 0) {
      setStaffId(bookableStaff[0]!.id);
    }
  }, [bookableStaff, staffId]);

  function onPlannedToothChange(treatmentId: string) {
    setPlannedTreatmentId(treatmentId);
    const treatment = plannedForTooth.find((t) => t.id === treatmentId);
    if (treatment) setReasonNote(summarizePlannedTreatment(treatment));
  }

  /** Returns whether the save succeeded, and (for a create) the new appointment's id if it wasn't queued offline. */
  async function saveAppointment(): Promise<{ ok: boolean; createdId?: string }> {
    if (!effectivePatient) {
      setError("Choose a patient first.");
      return { ok: false };
    }
    const startIso = fromDatetimeLocalValue(start);
    const endIso = new Date(new Date(startIso).getTime() + durationMinutes * 60000).toISOString();

    try {
      if (isEdit) {
        await updateAppointment.mutateAsync({
          patientId: effectivePatient.id,
          staffId,
          startAt: startIso,
          endAt: endIso,
          status: status as AppointmentStatus,
          reasonNote: reasonNote || null,
        });
        return { ok: true };
      } else {
        const staffName = staffList?.find((s) => s.id === staffId)?.name ?? "";
        const result = await createAppointment.mutateAsync({
          patientId: effectivePatient.id,
          staffId,
          startAt: startIso,
          endAt: endIso,
          status: "scheduled",
          reasonNote: reasonNote || undefined,
          patientName: effectivePatient.name,
          patientPhone: effectivePatient.phone,
          staffName,
        });
        return { ok: true, createdId: !result.queued ? result.data?.item.id : undefined };
      }
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Could not save the appointment.";
      setError(message);
      // A scheduling conflict is surfaced as a pop-up (not just inline text)
      // since it needs the staff member's attention right away, mid-booking.
      if (err instanceof ApiError && err.status === 409) alert(message);
      return { ok: false };
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    // Editing into one of these statuses offers a follow-up booking before
    // actually saving, rather than saving first and prompting after.
    if (isEdit && existing && status !== existing.status && (APPOINTMENT_STATUSES_OFFERING_FOLLOWUP as readonly string[]).includes(status)) {
      setFollowupPrompt(true);
      return;
    }
    const result = await saveAppointment();
    if (!result.ok) return;
    navigate(isEdit ? `/appointments/${id}` : result.createdId ? `/appointments/${result.createdId}` : "/appointments");
  }

  async function onSkipFollowup() {
    setFollowupPrompt(false);
    const result = await saveAppointment();
    if (result.ok) navigate(`/appointments/${id}`);
  }

  async function onBookFollowup() {
    setFollowupError(null);
    setFollowupSaving(true);
    try {
      const result = await saveAppointment();
      if (!result.ok) return;
      const followupStartIso = fromDatetimeLocalValue(followupStart);
      const followupEndIso = new Date(new Date(followupStartIso).getTime() + durationMinutes * 60000).toISOString();
      const staffName = staffList?.find((s) => s.id === staffId)?.name ?? "";
      const created = await createAppointment.mutateAsync({
        patientId: effectivePatient!.id,
        staffId,
        startAt: followupStartIso,
        endAt: followupEndIso,
        status: "scheduled",
        reasonNote: reasonNote || undefined,
        patientName: effectivePatient!.name,
        patientPhone: effectivePatient!.phone,
        staffName,
      });
      if (!created.queued && created.data) {
        // Goes through the mutation hook (not a raw api.patch call) so its
        // cache invalidation actually runs - otherwise the appointment
        // detail page we're about to navigate to would show stale data with
        // no follow-up link, even though the server-side update succeeded.
        await updateAppointment.mutateAsync({ rescheduledToAppointmentId: created.data.item.id });
      }
      setFollowupPrompt(false);
      navigate(`/appointments/${id}`);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Could not book the follow-up appointment.";
      setFollowupError(message);
      if (err instanceof ApiError && err.status === 409) alert(message);
    } finally {
      setFollowupSaving(false);
    }
  }

  const isSaving = createAppointment.isPending || updateAppointment.isPending || followupSaving;
  const minDatetime = nowDatetimeLocalValue();

  return (
    <div className="mx-auto max-w-lg">
      <PageHeader title={isEdit ? "Edit appointment" : "New appointment"} />
      <Card>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <Label>Patient</Label>
            {isEdit || preselectedPatientId ? (
              // Read-only: an appointment isn't reassigned to a different
              // patient by editing it, and (for the edit case) PatientPicker
              // only reads its `value` prop once at mount, so it can't
              // reflect the patient loading in asynchronously anyway.
              <p className="text-sm font-medium text-slate-900">{effectivePatient?.name ?? "Loading…"}</p>
            ) : (
              <PatientPicker value={patient} onChange={setPatient} />
            )}
          </div>
          {!isEdit && plannedForTooth.length > 0 && (
            <div>
              <Label htmlFor="plannedTooth">Planned treatment (optional)</Label>
              <Select id="plannedTooth" value={plannedTreatmentId} onChange={(e) => onPlannedToothChange(e.target.value)}>
                <option value="">— Select a tooth to auto-fill from its saved plan —</option>
                {plannedForTooth.map((t) => (
                  <option key={t.id} value={t.id}>
                    Tooth {t.toothNumber} — {t.procedure}
                  </option>
                ))}
              </Select>
              <p className="mt-1 text-xs text-slate-400">
                Picking a tooth fills in the reason below from its saved procedure, condition, notes and prescription.
              </p>
            </div>
          )}
          <div>
            <Label htmlFor="staff">Dentist / staff</Label>
            <Select id="staff" value={staffId} onChange={(e) => setStaffId(e.target.value)}>
              {isEdit && existing && !bookableStaff?.some((s) => s.id === existing.staffId) && (
                <option value={existing.staffId} disabled>
                  {existing.staffName} (no longer available)
                </option>
              )}
              {bookableStaff?.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="start">Date &amp; time</Label>
              <Input id="start" type="datetime-local" min={minDatetime} value={start} onChange={(e) => setStart(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="duration">Duration (minutes)</Label>
              <Input
                id="duration"
                type="number"
                min={5}
                step={5}
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(Number(e.target.value))}
              />
            </div>
          </div>
          {isEdit && (
            <div>
              <Label htmlFor="status">Status</Label>
              <Select id="status" value={status} onChange={(e) => setStatus(e.target.value)}>
                {APPOINTMENT_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s.replace("_", " ")}
                  </option>
                ))}
              </Select>
            </div>
          )}
          <div>
            <Label htmlFor="reason">Reason / notes (optional)</Label>
            <Textarea id="reason" rows={2} value={reasonNote} onChange={(e) => setReasonNote(e.target.value)} />
          </div>
          <FieldError>{error}</FieldError>
          <div className="flex gap-2">
            <Button type="submit" disabled={isSaving}>
              {isSaving ? "Saving…" : "Save appointment"}
            </Button>
            <Button type="button" variant="secondary" onClick={() => navigate(-1)}>
              Cancel
            </Button>
          </div>
        </form>
      </Card>

      {followupPrompt && (
        <Modal title={`Book a follow-up? (${status.replace("_", " ")})`}>
          <p className="text-sm text-slate-600">
            Pick a date and time for the next appointment, or skip if none is needed yet.
          </p>
          <div className="mt-3">
            <Label htmlFor="followupStart">Next appointment</Label>
            <Input
              id="followupStart"
              type="datetime-local"
              min={minDatetime}
              value={followupStart}
              onChange={(e) => setFollowupStart(e.target.value)}
            />
          </div>
          <FieldError>{followupError}</FieldError>
          <div className="mt-4 flex gap-2">
            <Button type="button" onClick={() => void onBookFollowup()} disabled={followupSaving}>
              {followupSaving ? "Booking…" : "Save & book follow-up"}
            </Button>
            <Button type="button" variant="secondary" onClick={() => void onSkipFollowup()} disabled={followupSaving}>
              Skip
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
