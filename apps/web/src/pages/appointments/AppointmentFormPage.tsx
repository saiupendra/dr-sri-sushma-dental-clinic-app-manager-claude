import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { APPOINTMENT_STATUSES } from "@clinic/shared";
import { useAppointment, useCreateAppointment, useUpdateAppointment } from "../../hooks/useAppointments.js";
import { useStaffList } from "../../hooks/useStaff.js";
import { usePatient } from "../../hooks/usePatients.js";
import { PatientPicker, type PickedPatient } from "../../components/PatientPicker.js";
import { fromDatetimeLocalValue, toDatetimeLocalValue } from "../../lib/dates.js";
import { ApiError } from "../../api/client.js";
import { Button, Card, FieldError, Input, Label, PageHeader, Select, Textarea } from "../../components/ui.js";

const DEFAULT_DURATION_MINUTES = 30;

export function AppointmentFormPage() {
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedPatientId = searchParams.get("patientId") ?? undefined;
  const { data: preselectedPatient } = usePatient(!isEdit ? preselectedPatientId : undefined);
  const { data: existing } = useAppointment(id);
  const { data: staffList } = useStaffList();
  const createAppointment = useCreateAppointment();
  const updateAppointment = useUpdateAppointment(id ?? "");

  const [patient, setPatient] = useState<PickedPatient | null>(null);
  const effectivePatient =
    patient ?? (preselectedPatient ? { id: preselectedPatient.id, name: preselectedPatient.name, phone: preselectedPatient.phone } : null);
  const [staffId, setStaffId] = useState("");
  const [start, setStart] = useState(() => {
    const d = new Date();
    d.setMinutes(Math.ceil(d.getMinutes() / 15) * 15, 0, 0);
    return toDatetimeLocalValue(d.toISOString());
  });
  const [durationMinutes, setDurationMinutes] = useState(DEFAULT_DURATION_MINUTES);
  const [status, setStatus] = useState<string>("scheduled");
  const [reasonNote, setReasonNote] = useState("");
  const [error, setError] = useState<string | null>(null);

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
    if (!staffId && staffList && staffList.length > 0) {
      setStaffId(staffList.find((s) => s.role === "doctor")?.id ?? staffList[0]!.id);
    }
  }, [staffList, staffId]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!effectivePatient) {
      setError("Choose a patient first.");
      return;
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
          status: status as (typeof APPOINTMENT_STATUSES)[number],
          reasonNote: reasonNote || null,
        });
        navigate(`/appointments/${id}`);
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
        navigate(result.queued ? "/appointments" : `/appointments/${result.data?.item.id}`);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save the appointment.");
    }
  }

  const isSaving = createAppointment.isPending || updateAppointment.isPending;

  return (
    <div className="mx-auto max-w-lg">
      <PageHeader title={isEdit ? "Edit appointment" : "New appointment"} />
      <Card>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <Label>Patient</Label>
            {preselectedPatientId && !isEdit ? (
              <p className="text-sm font-medium text-slate-900">{effectivePatient?.name}</p>
            ) : (
              <PatientPicker value={patient} onChange={setPatient} />
            )}
          </div>
          <div>
            <Label htmlFor="staff">Dentist / staff</Label>
            <Select id="staff" value={staffId} onChange={(e) => setStaffId(e.target.value)}>
              {staffList?.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} {s.role === "doctor" ? "(Doctor)" : "(Front desk)"}
                </option>
              ))}
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="start">Date &amp; time</Label>
              <Input id="start" type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} />
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
    </div>
  );
}
