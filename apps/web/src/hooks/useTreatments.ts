import { useQuery } from "@tanstack/react-query";
import type {
  CreateTreatmentRecordInput,
  TreatmentRecord,
  UpdateTreatmentRecordInput,
  UpdateTreatmentStatusInput,
} from "@clinic/shared";
import { api } from "../api/client.js";
import { useOfflineMutation } from "../offline/useOfflineMutation.js";

export function useTreatmentsList(patientId: string | undefined) {
  return useQuery({
    queryKey: ["treatments", "list", patientId],
    queryFn: () =>
      api.get<{ items: TreatmentRecord[] }>(`/api/treatments?patientId=${patientId}`).then((r) => r.items),
    enabled: !!patientId,
  });
}

export function useCreateTreatmentRecord(patientId: string) {
  return useOfflineMutation<CreateTreatmentRecordInput, { item: TreatmentRecord }>({
    method: "POST",
    path: () => "/api/treatments",
    body: (vars) => vars,
    entityLabel: (vars) => `Treatment note: ${vars.procedure}`,
    invalidateKeys: () => [
      ["treatments", "list", patientId],
      ["patients", "tooth-chart", patientId],
    ],
    optimisticUpdate: (qc, vars) => {
      const now = new Date().toISOString();
      const placeholder: TreatmentRecord = {
        id: vars.id ?? crypto.randomUUID(),
        patientId: vars.patientId,
        appointmentId: vars.appointmentId ?? null,
        toothNumber: vars.toothNumber ?? null,
        condition: vars.condition ?? null,
        conditionOther: vars.conditionOther ?? null,
        procedure: vars.procedure,
        notes: vars.notes ?? null,
        prescription: vars.prescription ?? null,
        status: vars.status ?? "completed",
        date: vars.date,
        staffId: vars.staffId,
        beforeTreatmentFileId: vars.beforeTreatmentFileId,
        createdAt: now,
        updatedAt: now,
      };
      qc.setQueryData<TreatmentRecord[]>(["treatments", "list", patientId], (old) =>
        old ? [placeholder, ...old] : old,
      );
    },
  });
}

// Admin-only edit of a saved record's content - see requireRole("admin") on
// PATCH /api/treatments/:id.
export function useUpdateTreatmentRecord(patientId: string, id: string) {
  return useOfflineMutation<UpdateTreatmentRecordInput, { item: TreatmentRecord }>({
    method: "PATCH",
    path: () => `/api/treatments/${id}`,
    body: (vars) => vars,
    entityLabel: () => "Update treatment note",
    invalidateKeys: () => [
      ["treatments", "list", patientId],
      ["patients", "tooth-chart", patientId],
    ],
  });
}

// The one edit a doctor can still make to a saved record - see
// requireRole("admin", "doctor") on PATCH /api/treatments/:id/status.
export function useUpdateTreatmentStatus(patientId: string, id: string) {
  return useOfflineMutation<UpdateTreatmentStatusInput, { item: TreatmentRecord }>({
    method: "PATCH",
    path: () => `/api/treatments/${id}/status`,
    body: (vars) => vars,
    entityLabel: () => "Update treatment status",
    invalidateKeys: () => [
      ["treatments", "list", patientId],
      ["patients", "tooth-chart", patientId],
    ],
  });
}
