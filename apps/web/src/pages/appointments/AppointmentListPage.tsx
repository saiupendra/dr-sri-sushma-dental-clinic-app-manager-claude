import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { APPOINTMENT_STATUSES, buildWhatsAppUrl, type AppointmentStatus, type AppointmentWithPatient } from "@clinic/shared";
import { useAppointmentsList } from "../../hooks/useAppointments.js";
import { startOfDayIso, endOfDayIso, formatDate, formatDateTime, formatTime, todayDateInputValue } from "../../lib/dates.js";
import {
  Avatar,
  Badge,
  Button,
  Card,
  ChevronLeftIcon,
  ChevronRightIcon,
  EmptyState,
  Input,
  PageHeader,
  PhoneIcon,
  Select,
  WhatsAppIcon,
} from "../../components/ui.js";

const STATUS_TONE: Record<string, "slate" | "green" | "amber" | "red" | "brand"> = {
  scheduled: "brand",
  confirmed: "green",
  completed: "slate",
  cancelled: "red",
  no_show: "amber",
};

function addDays(dateInputValue: string, delta: number): string {
  const d = new Date(`${dateInputValue}T00:00:00`);
  d.setDate(d.getDate() + delta);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function durationMinutes(startAt: string, endAt: string): number {
  return Math.round((new Date(endAt).getTime() - new Date(startAt).getTime()) / 60_000);
}

function AppointmentRow({ appt, showDate, isHappeningNow }: { appt: AppointmentWithPatient; showDate: boolean; isHappeningNow: boolean }) {
  const navigate = useNavigate();
  return (
    <Card
      className={`cursor-pointer transition hover:border-brand-200 hover:shadow-md ${
        isHappeningNow ? "border-l-4 border-l-emerald-500" : ""
      }`}
      onClick={() => navigate(`/appointments/${appt.id}`)}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <div className="w-20 shrink-0 text-right sm:w-24">
            <p className="text-sm font-semibold text-slate-900">{showDate ? formatDate(appt.startAt) : formatTime(appt.startAt)}</p>
            <p className="text-xs text-slate-400">{showDate ? formatTime(appt.startAt) : `${durationMinutes(appt.startAt, appt.endAt)} min`}</p>
          </div>
          <Avatar name={appt.patientName} size="sm" />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Link
                to={`/patients/${appt.patientId}`}
                onClick={(e) => e.stopPropagation()}
                className="font-semibold text-slate-900 hover:text-brand-800 hover:underline"
              >
                {appt.patientName}
              </Link>
              {isHappeningNow && <Badge tone="green">Now</Badge>}
            </div>
            <p className="text-xs text-slate-500">
              With {appt.staffName}
              {appt.reasonNote ? ` · ${appt.reasonNote}` : ""}
            </p>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <a
                href={`tel:${appt.patientPhone}`}
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
              >
                <PhoneIcon className="h-3.5 w-3.5" /> {appt.patientPhone}
              </a>
              <a
                href={buildWhatsAppUrl(appt.patientPhone, `Hi ${appt.patientName}, this is regarding your appointment on ${formatDateTime(appt.startAt)}.`)}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-100"
              >
                <WhatsAppIcon className="h-3.5 w-3.5" /> WhatsApp
              </a>
            </div>
          </div>
        </div>
        <Badge tone={STATUS_TONE[appt.status] ?? "slate"}>{appt.status.replace("_", " ")}</Badge>
      </div>
    </Card>
  );
}

export function AppointmentListPage() {
  const [date, setDate] = useState(todayDateInputValue());
  const [status, setStatus] = useState<"" | AppointmentStatus>("");
  const day = new Date(`${date}T00:00:00`);
  const isToday = date === todayDateInputValue();
  const now = Date.now();
  // Picking a status (e.g. "completed") switches from "today's schedule" to
  // browsing history across every date - a single day is rarely useful once
  // you're looking for completed or cancelled appointments, not today's list.
  const { data: appointments, isLoading } = useAppointmentsList(
    status ? { status } : { from: startOfDayIso(day), to: endOfDayIso(day) },
  );

  const dayLabel = new Intl.DateTimeFormat("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Asia/Kolkata",
  }).format(day);

  return (
    <div>
      <PageHeader
        title="Appointments"
        subtitle={
          status
            ? undefined
            : `${isToday ? "Today" : dayLabel}${appointments ? ` · ${appointments.length} appointment${appointments.length === 1 ? "" : "s"}` : ""}`
        }
        action={
          <Link to="/appointments/new">
            <Button>New appointment</Button>
          </Link>
        }
      />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        {!status && (
          <div className="flex items-center gap-1.5">
            <Button variant="secondary" size="sm" onClick={() => setDate((d) => addDays(d, -1))} aria-label="Previous day">
              <ChevronLeftIcon />
            </Button>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-auto" />
            <Button variant="secondary" size="sm" onClick={() => setDate((d) => addDays(d, 1))} aria-label="Next day">
              <ChevronRightIcon />
            </Button>
            {!isToday && (
              <Button variant="ghost" size="sm" onClick={() => setDate(todayDateInputValue())}>
                Today
              </Button>
            )}
          </div>
        )}
        <Select
          value={status}
          onChange={(e) => setStatus(e.target.value as "" | AppointmentStatus)}
          className="w-auto"
        >
          <option value="">Today's schedule</option>
          {APPOINTMENT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s.replace("_", " ")} (all dates)
            </option>
          ))}
        </Select>
      </div>

      {isLoading && <p className="text-sm text-slate-400">Loading…</p>}
      {!isLoading && (!appointments || appointments.length === 0) && (
        <EmptyState>{status ? `No ${status.replace("_", " ")} appointments yet.` : "No appointments on this day."}</EmptyState>
      )}
      {!!appointments?.length && (
        <div className="space-y-3">
          {appointments.map((appt) => (
            <AppointmentRow
              key={appt.id}
              appt={appt}
              showDate={!!status}
              isHappeningNow={
                !status &&
                isToday &&
                (appt.status === "scheduled" || appt.status === "confirmed") &&
                new Date(appt.startAt).getTime() <= now &&
                new Date(appt.endAt).getTime() > now
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
