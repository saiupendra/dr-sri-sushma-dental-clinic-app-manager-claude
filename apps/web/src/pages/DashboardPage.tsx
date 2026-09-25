import { Link } from "react-router-dom";
import { useAppointmentsList } from "../hooks/useAppointments.js";
import { useAuth } from "../auth/useAuth.js";
import { startOfDayIso, endOfDayIso, formatTime } from "../lib/dates.js";
import { Badge, Button, Card, EmptyState, PageHeader } from "../components/ui.js";

const STATUS_TONE: Record<string, "slate" | "green" | "amber" | "red" | "brand"> = {
  scheduled: "brand",
  confirmed: "green",
  completed: "slate",
  cancelled: "red",
  no_show: "amber",
};

export function DashboardPage() {
  const { user } = useAuth();
  const now = new Date();
  const { data: appointments, isLoading } = useAppointmentsList({
    from: startOfDayIso(now),
    to: endOfDayIso(now),
  });

  return (
    <div>
      <PageHeader
        title={`Good day${user?.name ? `, ${user.name}` : ""}`}
        subtitle="Here's what's on today at the clinic."
        action={
          <div className="flex gap-2">
            <Link to="/patients/new">
              <Button variant="secondary">New patient</Button>
            </Link>
            <Link to="/appointments/new">
              <Button>New appointment</Button>
            </Link>
          </div>
        }
      />

      <Card>
        <h2 className="mb-3 text-sm font-semibold text-slate-700">Today's appointments</h2>
        {isLoading && <p className="text-sm text-slate-400">Loading…</p>}
        {!isLoading && (!appointments || appointments.length === 0) && (
          <EmptyState>No appointments scheduled for today.</EmptyState>
        )}
        {!!appointments?.length && (
          <ul className="divide-y divide-slate-100">
            {appointments.map((appt) => (
              <li key={appt.id} className="flex items-center justify-between gap-3 py-3">
                <div>
                  <Link to={`/patients/${appt.patientId}`} className="font-medium text-slate-900 hover:underline">
                    {appt.patientName}
                  </Link>
                  <p className="text-sm text-slate-500">
                    {formatTime(appt.startAt)} – {formatTime(appt.endAt)} · {appt.staffName}
                    {appt.reasonNote ? ` · ${appt.reasonNote}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone={STATUS_TONE[appt.status] ?? "slate"}>{appt.status.replace("_", " ")}</Badge>
                  <Link to={`/appointments/${appt.id}`} className="text-sm text-brand-700 hover:underline">
                    Open
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
