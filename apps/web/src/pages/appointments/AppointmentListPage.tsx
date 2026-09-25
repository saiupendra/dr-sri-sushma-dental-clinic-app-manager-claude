import { useState } from "react";
import { Link } from "react-router-dom";
import { useAppointmentsList } from "../../hooks/useAppointments.js";
import { startOfDayIso, endOfDayIso, formatTime, todayDateInputValue } from "../../lib/dates.js";
import { Badge, Button, Card, EmptyState, Input, PageHeader } from "../../components/ui.js";

const STATUS_TONE: Record<string, "slate" | "green" | "amber" | "red" | "brand"> = {
  scheduled: "brand",
  confirmed: "green",
  completed: "slate",
  cancelled: "red",
  no_show: "amber",
};

export function AppointmentListPage() {
  const [date, setDate] = useState(todayDateInputValue());
  const day = new Date(`${date}T00:00:00`);
  const { data: appointments, isLoading } = useAppointmentsList({
    from: startOfDayIso(day),
    to: endOfDayIso(day),
  });

  return (
    <div>
      <PageHeader
        title="Appointments"
        action={
          <Link to="/appointments/new">
            <Button>New appointment</Button>
          </Link>
        }
      />
      <div className="mb-4 flex items-center gap-3">
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-auto" />
      </div>
      <Card>
        {isLoading && <p className="text-sm text-slate-400">Loading…</p>}
        {!isLoading && (!appointments || appointments.length === 0) && (
          <EmptyState>No appointments on this day.</EmptyState>
        )}
        {!!appointments?.length && (
          <ul className="divide-y divide-slate-100">
            {appointments.map((appt) => (
              <li key={appt.id}>
                <Link
                  to={`/appointments/${appt.id}`}
                  className="flex items-center justify-between gap-3 py-3 hover:bg-slate-50"
                >
                  <div>
                    <p className="font-medium text-slate-900">{appt.patientName}</p>
                    <p className="text-sm text-slate-500">
                      {formatTime(appt.startAt)} – {formatTime(appt.endAt)} · {appt.staffName}
                    </p>
                  </div>
                  <Badge tone={STATUS_TONE[appt.status] ?? "slate"}>{appt.status.replace("_", " ")}</Badge>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
