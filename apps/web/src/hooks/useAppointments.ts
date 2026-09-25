import { useQuery } from "@tanstack/react-query";
import type { AppointmentWithPatient, CreateAppointmentInput, UpdateAppointmentInput } from "@clinic/shared";
import { api } from "../api/client.js";
import { useOfflineMutation } from "../offline/useOfflineMutation.js";

interface AppointmentListParams {
  from?: string;
  to?: string;
  patientId?: string;
  staffId?: string;
  status?: string;
}

function toQueryString(params: AppointmentListParams): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value);
  }
  const str = search.toString();
  return str ? `?${str}` : "";
}

export function useAppointmentsList(params: AppointmentListParams) {
  return useQuery({
    queryKey: ["appointments", "list", params],
    queryFn: () =>
      api
        .get<{ items: AppointmentWithPatient[] }>(`/api/appointments${toQueryString(params)}`)
        .then((r) => r.items),
  });
}

export function useAppointment(id: string | undefined) {
  return useQuery({
    queryKey: ["appointments", "detail", id],
    queryFn: () => api.get<{ item: AppointmentWithPatient }>(`/api/appointments/${id}`).then((r) => r.item),
    enabled: !!id,
  });
}

/** Extra display-only fields so the optimistic placeholder can show a name instead of a blank row while offline. */
type CreateAppointmentVars = CreateAppointmentInput & { patientName: string; patientPhone: string; staffName: string };

export function useCreateAppointment() {
  return useOfflineMutation<CreateAppointmentVars, { item: AppointmentWithPatient }>({
    method: "POST",
    path: () => "/api/appointments",
    body: (vars) => {
      const { patientName: _pn, patientPhone: _pp, staffName: _sn, ...body } = vars;
      return body;
    },
    entityLabel: (vars) => `Appointment: ${vars.patientName}`,
    invalidateKeys: () => [["appointments", "list"]],
    optimisticUpdate: (qc, vars) => {
      qc.setQueriesData<AppointmentWithPatient[]>({ queryKey: ["appointments", "list"] }, (old) => {
        if (!old) return old;
        const now = new Date().toISOString();
        const placeholder: AppointmentWithPatient = {
          id: vars.id ?? crypto.randomUUID(),
          patientId: vars.patientId,
          staffId: vars.staffId,
          startAt: vars.startAt,
          endAt: vars.endAt,
          status: vars.status ?? "scheduled",
          reasonNote: vars.reasonNote ?? null,
          createdBy: null,
          createdAt: now,
          updatedAt: now,
          patientName: vars.patientName,
          patientPhone: vars.patientPhone,
          staffName: vars.staffName,
        };
        return [...old, placeholder].sort((a, b) => a.startAt.localeCompare(b.startAt));
      });
    },
  });
}

export function useUpdateAppointment(id: string) {
  return useOfflineMutation<UpdateAppointmentInput, { item: AppointmentWithPatient }>({
    method: "PATCH",
    path: () => `/api/appointments/${id}`,
    body: (vars) => vars,
    entityLabel: () => "Update appointment",
    invalidateKeys: () => [["appointments", "list"], ["appointments", "detail", id]],
    optimisticUpdate: (qc, vars) => {
      qc.setQueryData<AppointmentWithPatient>(["appointments", "detail", id], (old) =>
        old ? { ...old, ...vars, updatedAt: new Date().toISOString() } : old,
      );
      qc.setQueriesData<AppointmentWithPatient[]>({ queryKey: ["appointments", "list"] }, (old) =>
        old?.map((appt) => (appt.id === id ? { ...appt, ...vars, updatedAt: new Date().toISOString() } : appt)),
      );
    },
  });
}
