import { useState } from "react";
import { Link } from "react-router-dom";
import type { AppointmentWithPatient } from "@clinic/shared";
import { useAppointmentsList } from "../hooks/useAppointments.js";
import { useAuth } from "../auth/useAuth.js";
import { formatTime, toLocalDateString } from "../lib/dates.js";
import { Badge, EmptyState } from "../components/ui.js";

type TileFilter = "appointments" | "remaining" | "completed" | "changed";

const STATUS_TONE: Record<string, "slate" | "green" | "amber" | "red" | "brand"> = {
  scheduled: "brand", confirmed: "green", completed: "slate", cancelled: "red", no_show: "amber", rescheduled: "amber",
};

/** The daily summary follows the clinic's calendar day, regardless of device timezone. */
function clinicDayBounds(now: Date) {
  const day = toLocalDateString(now.toISOString());
  const start = new Date(`${day}T00:00:00+05:30`).getTime();
  return { from: new Date(start).toISOString(), to: new Date(start + 86_400_000 - 1).toISOString() };
}

export function DashboardPage() {
  const { user } = useAuth();
  const now = new Date();
  const { data: appointments, isLoading, isError } = useAppointmentsList(clinicDayBounds(now));
  const today = appointments ?? [];
  const active = today.filter((a) => a.status !== "cancelled" && a.status !== "no_show" && a.status !== "rescheduled");
  const remaining = active.filter((a) => a.status !== "completed" && new Date(a.endAt).getTime() > now.getTime());
  const completedList = today.filter((a) => a.status === "completed");
  const changedList = today.filter((a) => a.status === "no_show" || a.status === "cancelled" || a.status === "rescheduled");
  const next = remaining[0];
  const dateLabel = new Intl.DateTimeFormat("en-IN", {
    weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kolkata",
  }).format(now);

  const [tileFilter, setTileFilter] = useState<TileFilter | null>(null);
  const filterLists: Record<TileFilter, { list: AppointmentWithPatient[]; label: string }> = {
    appointments: { list: active, label: "Appointments" },
    remaining: { list: remaining, label: "Still to see" },
    completed: { list: completedList, label: "Completed" },
    changed: { list: changedList, label: "Changed plans" },
  };
  const visible = tileFilter ? filterLists[tileFilter].list : today;

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-950 via-blue-900 to-blue-700 px-5 py-7 text-white shadow-lg sm:px-8 sm:py-9">
        <div className="pointer-events-none absolute -right-16 -top-24 h-72 w-72 rounded-full border-[40px] border-white/5" />
        <div className="relative flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-200">Clinic overview · {dateLabel}</p>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">Good day{user?.name ? `, ${user.name}` : ""}</h1>
            <p className="mt-2 max-w-lg text-sm text-blue-100">Your appointments and the next steps for today, all in one place.</p>
          </div>
          <Link to="/appointments/new" className="inline-flex items-center rounded-lg bg-white px-4 py-2 text-sm font-semibold text-blue-900 shadow-sm hover:bg-blue-50">+ New appointment</Link>
        </div>
      </section>

      <section aria-label="Today's appointment summary" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {(
          [
            { key: "appointments", label: "Appointments", value: active.length, hint: "On today's schedule", color: "text-blue-800", stripe: "bg-blue-600" },
            { key: "remaining", label: "Still to see", value: remaining.length, hint: "Upcoming or in progress", color: "text-indigo-800", stripe: "bg-indigo-600" },
            { key: "completed", label: "Completed", value: completedList.length, hint: "Visits finished today", color: "text-emerald-800", stripe: "bg-emerald-600" },
            { key: "changed", label: "Changed plans", value: changedList.length, hint: "Cancelled or no show", color: "text-amber-800", stripe: "bg-amber-500" },
          ] as const
        ).map((metric) => (
          <button
            key={metric.key}
            type="button"
            aria-pressed={tileFilter === metric.key}
            onClick={() => setTileFilter((prev) => (prev === metric.key ? null : metric.key))}
            className={`overflow-hidden rounded-xl border bg-white text-left shadow-sm transition hover:border-blue-300 ${
              tileFilter === metric.key ? "border-blue-500 ring-2 ring-blue-200" : "border-slate-200"
            }`}
          >
            <div className={`h-1 ${metric.stripe}`} />
            <div className="p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{metric.label}</p>
              <p className={`mt-2 text-3xl font-semibold ${metric.color}`}>{isLoading ? "…" : isError ? "—" : metric.value}</p>
              <p className="mt-1 text-xs text-slate-500">{metric.hint}</p>
            </div>
          </button>
        ))}
      </section>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.8fr)_minmax(260px,1fr)]">
        <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 p-5">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                {tileFilter ? `Today's schedule · ${filterLists[tileFilter].label}` : "Today's schedule"}
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                {tileFilter ? (
                  <button type="button" onClick={() => setTileFilter(null)} className="font-medium text-blue-700 hover:underline">
                    Clear filter · show all
                  </button>
                ) : (
                  "Appointments are shown in time order. Tap a tile above to filter."
                )}
              </p>
            </div>
            <Link to="/appointments" className="shrink-0 text-sm font-medium text-blue-700 hover:underline">View calendar →</Link>
          </div>
          <div className="px-5 py-2">
            {isLoading && <p className="py-7 text-sm text-slate-500">Loading today's appointments…</p>}
            {isError && <p className="py-7 text-sm text-red-700">Could not load the schedule. Try again when connected.</p>}
            {!isLoading && !isError && visible.length === 0 && (
              <div className="py-5">
                <EmptyState>
                  {tileFilter ? `No appointments match "${filterLists[tileFilter].label}" today.` : "No appointments scheduled for today."}
                </EmptyState>
              </div>
            )}
            {visible.map((appt) => (
              <Link key={appt.id} to={`/appointments/${appt.id}`}
                className="flex items-center gap-3 border-b border-slate-100 py-4 last:border-0 hover:bg-blue-50/50">
                <span className="w-20 shrink-0 text-xs font-semibold text-blue-800 sm:w-24 sm:text-sm">{formatTime(appt.startAt)}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-slate-900">{appt.patientName}</span>
                  <span className="block truncate text-xs text-slate-500">{appt.staffName}{appt.reasonNote ? ` · ${appt.reasonNote}` : ""}</span>
                </span>
                <Badge tone={STATUS_TONE[appt.status] ?? "slate"}>{appt.status.replace("_", " ")}</Badge>
              </Link>
            ))}
          </div>
        </section>

        <div className="space-y-5">
          <section className="rounded-xl border border-blue-100 bg-blue-50 p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Up next</p>
            {next ? (
              <>
                <p className="mt-3 text-xl font-semibold text-slate-900">{formatTime(next.startAt)}</p>
                <p className="mt-1 text-sm font-medium text-slate-800">{next.patientName}</p>
                <p className="mt-1 text-xs text-slate-600">{next.staffName} · until {formatTime(next.endAt)}</p>
                <Link to={`/appointments/${next.id}`} className="mt-4 inline-block text-sm font-semibold text-blue-800 hover:underline">Open appointment →</Link>
              </>
            ) : (
              <p className="mt-3 text-sm text-slate-600">
                {isLoading ? "Checking the schedule…" : isError ? "Schedule unavailable." : "No upcoming appointments today."}
              </p>
            )}
          </section>
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-slate-900">Quick actions</h2>
            <p className="mt-1 text-xs text-slate-500">Common front desk tasks</p>
            <div className="mt-4 grid gap-2">
              <Link to="/patients/new" className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-medium text-slate-800 hover:border-blue-300 hover:bg-blue-50">+ Add patient</Link>
              <Link to="/appointments/new" className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-medium text-slate-800 hover:border-blue-300 hover:bg-blue-50">+ Schedule appointment</Link>
              <Link to="/billing" className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-medium text-slate-800 hover:border-blue-300 hover:bg-blue-50">View billing</Link>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
