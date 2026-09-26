import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { buildWhatsAppUrl, CLINIC_NAME, type PatientListItem } from "@clinic/shared";
import { usePatientsList } from "../../hooks/usePatients.js";
import { formatDate, formatDateTime } from "../../lib/dates.js";
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
  SearchIcon,
  WhatsAppIcon,
} from "../../components/ui.js";

/** Whole years between a YYYY-MM-DD date of birth and today, or null if unknown. */
function calculateAge(dateOfBirth: string | null): number | null {
  if (!dateOfBirth) return null;
  const birth = new Date(dateOfBirth);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const beforeBirthdayThisYear =
    today.getMonth() < birth.getMonth() || (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate());
  if (beforeBirthdayThisYear) age--;
  return age;
}

function PatientCard({ patient }: { patient: PatientListItem }) {
  const navigate = useNavigate();
  const age = calculateAge(patient.dateOfBirth);
  const details = [age != null ? `${age} yrs` : null, patient.sex !== "unspecified" ? patient.sex : null]
    .filter(Boolean)
    .join(" · ");

  return (
    <Card
      className="cursor-pointer transition hover:border-brand-200 hover:shadow-md"
      onClick={() => navigate(`/patients/${patient.id}`)}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <Avatar name={patient.name} />
          <div className="min-w-0">
            <Link
              to={`/patients/${patient.id}`}
              onClick={(e) => e.stopPropagation()}
              className="font-semibold text-slate-900 hover:text-brand-800 hover:underline"
            >
              {patient.name}
            </Link>
            {details && <p className="text-xs text-slate-400">{details}</p>}
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <a
                href={`tel:${patient.phone}`}
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
              >
                <PhoneIcon className="h-3.5 w-3.5" /> {patient.phone}
              </a>
              <a
                href={buildWhatsAppUrl(patient.phone, `Hi ${patient.name}, this is ${CLINIC_NAME}.`)}
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
        <div className="flex flex-col items-end gap-1.5 text-right">
          {patient.nextAppointment ? (
            <Badge tone="brand">Next: {formatDateTime(patient.nextAppointment.startAt)}</Badge>
          ) : (
            <span className="text-xs text-slate-400">No upcoming appointment</span>
          )}
          <span className="text-xs text-slate-400">
            {patient.lastVisitAt ? `Last visit ${formatDate(patient.lastVisitAt)}` : "No visits yet"}
          </span>
          {patient.balanceDue > 0 && <Badge tone="red">₹{patient.balanceDue.toFixed(2)} due</Badge>}
        </div>
      </div>
    </Card>
  );
}

export function PatientListPage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const { data, isLoading } = usePatientsList(search, page);

  return (
    <div>
      <PageHeader
        title="Patients"
        subtitle={data ? `${data.total} patient${data.total === 1 ? "" : "s"} on record` : undefined}
        action={
          <Link to="/patients/new">
            <Button>New patient</Button>
          </Link>
        }
      />
      <div className="relative mb-4 max-w-sm">
        <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input
          placeholder="Search by name or phone…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="pl-9"
        />
      </div>

      {isLoading && <p className="text-sm text-slate-400">Loading…</p>}
      {!isLoading && data?.items.length === 0 && <EmptyState>No patients found.</EmptyState>}
      {!!data?.items.length && (
        <div className="space-y-3">
          {data.items.map((patient) => (
            <PatientCard key={patient.id} patient={patient} />
          ))}
        </div>
      )}

      {!!data && data.total > data.pageSize && (
        <div className="mt-4 flex items-center justify-between text-sm text-slate-500">
          <span>
            Page {data.page} of {Math.ceil(data.total / data.pageSize)} · {data.total} patients
          </span>
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              <ChevronLeftIcon /> Previous
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={page >= Math.ceil(data.total / data.pageSize)}
              onClick={() => setPage((p) => p + 1)}
            >
              Next <ChevronRightIcon />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
