import { Link, useNavigate, useParams } from "react-router-dom";
import { useAppointment } from "../../hooks/useAppointments.js";
import { useMarkReminderSent, useRemindersList, useSendReminder } from "../../hooks/useReminders.js";
import { useTreatmentsList } from "../../hooks/useTreatments.js";
import { formatDate, formatDateTime, toLocalDateString } from "../../lib/dates.js";
import { Badge, Button, Card, EmptyState, PageHeader, Spinner } from "../../components/ui.js";

export function AppointmentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: appointment, isLoading } = useAppointment(id);
  const { data: reminders } = useRemindersList(id);
  const { data: treatments } = useTreatmentsList(appointment?.patientId);
  const sendReminder = useSendReminder(id ?? "");
  const markSent = useMarkReminderSent(id ?? "");

  if (isLoading) return <p className="text-sm text-slate-400">Loading…</p>;
  if (!appointment) return <p className="text-sm text-slate-500">Appointment not found.</p>;

  async function onSendReminder() {
    const result = await sendReminder.mutateAsync();
    window.open(result.whatsappUrl, "_blank", "noopener");
  }

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <PageHeader
        title="Appointment"
        action={
          <Button variant="secondary" onClick={() => navigate(`/appointments/${id}/edit`)}>
            Edit
          </Button>
        }
      />
      <Card>
        <dl className="grid grid-cols-3 gap-y-3 text-sm">
          <dt className="text-slate-500">Patient</dt>
          <dd className="col-span-2">
            <Link to={`/patients/${appointment.patientId}`} className="font-medium text-brand-700 hover:underline">
              {appointment.patientName}
            </Link>
          </dd>
          <dt className="text-slate-500">With</dt>
          <dd className="col-span-2">{appointment.staffName}</dd>
          <dt className="text-slate-500">When</dt>
          <dd className="col-span-2">
            {formatDateTime(appointment.startAt)} – {formatDateTime(appointment.endAt)}
          </dd>
          <dt className="text-slate-500">Status</dt>
          <dd className="col-span-2">
            <Badge tone={appointment.status === "cancelled" ? "red" : "brand"}>
              {appointment.status.replace("_", " ")}
            </Badge>
          </dd>
          {appointment.reasonNote && (
            <>
              <dt className="text-slate-500">Notes</dt>
              <dd className="col-span-2">{appointment.reasonNote}</dd>
            </>
          )}
        </dl>
      </Card>

      <Card>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-700">Treatment notes from this visit</h2>
          <Link
            to={`/patients/${appointment.patientId}?tab=treatments`}
            className="text-sm font-medium text-brand-700 hover:underline"
          >
            All treatment notes →
          </Link>
        </div>
        {(() => {
          const visitDate = toLocalDateString(appointment.startAt);
          const sameDay = treatments?.filter((t) => t.date === visitDate) ?? [];
          if (sameDay.length === 0) {
            return (
              <EmptyState>
                No treatment note dated to this visit yet. Add one from the patient&apos;s Treatment notes tab.
              </EmptyState>
            );
          }
          return (
            <ul className="divide-y divide-slate-100">
              {sameDay.map((t) => (
                <li key={t.id} className="py-2 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium text-slate-900">
                      {t.procedure} {t.toothNumber && <span className="text-slate-400">· Tooth {t.toothNumber}</span>}
                    </p>
                    <Badge tone={t.status === "planned" ? "amber" : "green"}>{t.status}</Badge>
                  </div>
                  <p className="text-xs text-slate-400">{formatDate(t.date)}</p>
                </li>
              ))}
            </ul>
          );
        })()}
      </Card>

      <Card>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-700">WhatsApp reminders</h2>
          <Button size="sm" onClick={() => void onSendReminder()} disabled={sendReminder.isPending}>
            {sendReminder.isPending ? <Spinner /> : "Send reminder"}
          </Button>
        </div>
        {!reminders?.length && <p className="text-sm text-slate-400">No reminders sent yet for this appointment.</p>}
        <ul className="space-y-2">
          {reminders?.map((reminder) => (
            <li key={reminder.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 p-2 text-sm">
              <div>
                <p className="text-slate-700">{reminder.message}</p>
                <p className="text-xs text-slate-400">{formatDateTime(reminder.createdAt)}</p>
              </div>
              {reminder.status === "sent" ? (
                <Badge tone="green">Sent</Badge>
              ) : (
                <Button size="sm" variant="secondary" onClick={() => markSent.mutate(reminder.id)}>
                  Mark sent
                </Button>
              )}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
