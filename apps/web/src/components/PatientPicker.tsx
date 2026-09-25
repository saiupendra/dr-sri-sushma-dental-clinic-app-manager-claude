import { useEffect, useRef, useState } from "react";
import type { Patient } from "@clinic/shared";
import { usePatientsList } from "../hooks/usePatients.js";
import { Input } from "./ui.js";

export interface PickedPatient {
  id: string;
  name: string;
  phone: string;
}

export function PatientPicker({
  value,
  onChange,
}: {
  value: PickedPatient | null;
  onChange: (patient: PickedPatient | null) => void;
}) {
  const [term, setTerm] = useState(value?.name ?? "");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const { data, isFetching } = usePatientsList(term.length >= 2 ? term : "", 1);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  function select(patient: Patient) {
    onChange({ id: patient.id, name: patient.name, phone: patient.phone });
    setTerm(patient.name);
    setOpen(false);
  }

  return (
    <div ref={containerRef} className="relative">
      <Input
        value={term}
        placeholder="Search by name or phone…"
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setTerm(e.target.value);
          setOpen(true);
          if (value) onChange(null);
        }}
      />
      {open && term.length >= 2 && (
        <div className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg">
          {isFetching && <div className="px-3 py-2 text-sm text-slate-400">Searching…</div>}
          {!isFetching && data?.items.length === 0 && (
            <div className="px-3 py-2 text-sm text-slate-400">No patients found</div>
          )}
          {data?.items.map((patient) => (
            <button
              key={patient.id}
              type="button"
              onClick={() => select(patient)}
              className="block w-full px-3 py-2 text-left text-sm hover:bg-brand-50"
            >
              <span className="font-medium text-slate-900">{patient.name}</span>{" "}
              <span className="text-slate-500">{patient.phone}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
