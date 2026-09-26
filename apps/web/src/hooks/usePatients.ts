import { useQuery } from "@tanstack/react-query";
import type { CreatePatientInput, Patient, PatientListItem, ToothChartEntry, UpdatePatientInput } from "@clinic/shared";
import { api } from "../api/client.js";
import { useOfflineMutation } from "../offline/useOfflineMutation.js";

interface PatientListResponse {
  items: PatientListItem[];
  page: number;
  pageSize: number;
  total: number;
}

function placeholderPatient(vars: CreatePatientInput): PatientListItem {
  const now = new Date().toISOString();
  return {
    id: vars.id ?? crypto.randomUUID(),
    name: vars.name,
    phone: vars.phone,
    email: vars.email ?? null,
    dateOfBirth: vars.dateOfBirth ?? null,
    sex: vars.sex ?? "unspecified",
    address: vars.address,
    medicalHistoryNotes: vars.medicalHistoryNotes,
    heightFeet: vars.heightFeet ?? null,
    weightKg: vars.weightKg ?? null,
    bloodPressure: vars.bloodPressure ?? null,
    bloodSugar: vars.bloodSugar ?? null,
    consultationFee: vars.consultationFee ?? null,
    createdBy: null,
    createdAt: now,
    updatedAt: now,
    // A freshly-created patient has no visit/billing history yet - the real
    // values arrive once the list query is invalidated and refetched.
    nextAppointment: null,
    lastVisitAt: null,
    balanceDue: 0,
  };
}

export function usePatientsList(search: string, page = 1) {
  return useQuery({
    queryKey: ["patients", "list", { search, page }],
    queryFn: () =>
      api.get<PatientListResponse>(
        `/api/patients?page=${page}&pageSize=25${search ? `&search=${encodeURIComponent(search)}` : ""}`,
      ),
    placeholderData: (prev) => prev,
  });
}

export function usePatient(id: string | undefined) {
  return useQuery({
    queryKey: ["patients", "detail", id],
    queryFn: () => api.get<{ item: Patient }>(`/api/patients/${id}`).then((r) => r.item),
    enabled: !!id,
  });
}

export function usePatientToothChart(id: string | undefined) {
  return useQuery({
    queryKey: ["patients", "tooth-chart", id],
    queryFn: () => api.get<{ items: ToothChartEntry[] }>(`/api/patients/${id}/tooth-chart`).then((r) => r.items),
    enabled: !!id,
  });
}

export function useCreatePatient() {
  return useOfflineMutation<CreatePatientInput, { item: Patient }>({
    method: "POST",
    path: () => "/api/patients",
    body: (vars) => vars,
    entityLabel: (vars) => `New patient: ${vars.name}`,
    invalidateKeys: () => [["patients", "list"]],
    optimisticUpdate: (qc, vars) => {
      qc.setQueriesData<PatientListResponse>({ queryKey: ["patients", "list"] }, (old) =>
        old ? { ...old, items: [placeholderPatient(vars), ...old.items], total: old.total + 1 } : old,
      );
    },
  });
}

export function useUpdatePatient(id: string) {
  return useOfflineMutation<UpdatePatientInput, { item: Patient }>({
    method: "PATCH",
    path: () => `/api/patients/${id}`,
    body: (vars) => vars,
    entityLabel: () => "Update patient details",
    invalidateKeys: () => [["patients", "detail", id], ["patients", "list"]],
    optimisticUpdate: (qc, vars) => {
      qc.setQueryData<Patient>(["patients", "detail", id], (old) =>
        old ? { ...old, ...vars, updatedAt: new Date().toISOString() } : old,
      );
    },
  });
}

// Admin-only (see routes/patients.ts) - not exposed to doctor/front_desk in the UI.
export function useDeletePatient(id: string) {
  return useOfflineMutation<void, { ok: true }>({
    method: "DELETE",
    path: () => `/api/patients/${id}`,
    entityLabel: () => "Delete patient",
    invalidateKeys: () => [["patients", "detail", id], ["patients", "list"]],
  });
}
