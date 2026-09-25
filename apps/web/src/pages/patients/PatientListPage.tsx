import { useState } from "react";
import { Link } from "react-router-dom";
import { usePatientsList } from "../../hooks/usePatients.js";
import { Button, Card, EmptyState, Input, PageHeader } from "../../components/ui.js";

export function PatientListPage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const { data, isLoading } = usePatientsList(search, page);

  return (
    <div>
      <PageHeader
        title="Patients"
        action={
          <Link to="/patients/new">
            <Button>New patient</Button>
          </Link>
        }
      />
      <div className="mb-4">
        <Input
          placeholder="Search by name or phone…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="max-w-sm"
        />
      </div>
      <Card>
        {isLoading && <p className="text-sm text-slate-400">Loading…</p>}
        {!isLoading && data?.items.length === 0 && <EmptyState>No patients found.</EmptyState>}
        {!!data?.items.length && (
          <ul className="divide-y divide-slate-100">
            {data.items.map((patient) => (
              <li key={patient.id}>
                <Link to={`/patients/${patient.id}`} className="flex items-center justify-between gap-3 py-3 hover:bg-slate-50">
                  <div>
                    <p className="font-medium text-slate-900">{patient.name}</p>
                    <p className="text-sm text-slate-500">{patient.phone}</p>
                  </div>
                  {patient.dateOfBirth && <span className="text-sm text-slate-400">DOB {patient.dateOfBirth}</span>}
                </Link>
              </li>
            ))}
          </ul>
        )}
        {!!data && data.total > data.pageSize && (
          <div className="mt-4 flex items-center justify-between text-sm text-slate-500">
            <span>
              Page {data.page} of {Math.ceil(data.total / data.pageSize)} · {data.total} patients
            </span>
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Previous
              </Button>
              <Button
                size="sm"
                variant="secondary"
                disabled={page >= Math.ceil(data.total / data.pageSize)}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
