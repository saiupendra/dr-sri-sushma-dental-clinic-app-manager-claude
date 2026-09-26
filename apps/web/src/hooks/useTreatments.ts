import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  CompleteTreatmentRecordInput,
  CreateTreatmentRecordInput,
  TreatmentRecord,
  UpdateTreatmentRecordInput,
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
        status: "planned",
        date: now.slice(0, 10),
        completedDate: null,
        postTreatmentNotes: null,
        staffId: vars.staffId,
        beforeTreatmentFileIds: vars.beforeTreatmentFileIds,
        afterTreatmentFileIds: [],
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

// Admin-only (see requireRole("admin") on DELETE /api/treatments/:id) - not
// exposed to doctor/front_desk in the UI. Once a clinical note is saved,
// only admin can remove it.
export function useDeleteTreatmentRecord(patientId: string, id: string) {
  return useOfflineMutation<void, { ok: true }>({
    method: "DELETE",
    path: () => `/api/treatments/${id}`,
    entityLabel: () => "Delete treatment note",
    invalidateKeys: () => [
      ["treatments", "list", patientId],
      ["patients", "tooth-chart", patientId],
    ],
  });
}

// The one-way move from planned to completed - requires post-operative
// photos, post-operative notes and the treatment-done date (see
// requireRole("admin", "doctor") on PATCH /api/treatments/:id/complete).
// This needs a live connection (it follows photo uploads, which do too), so
// it's a plain mutation rather than routed through the offline outbox.
export function useCompleteTreatmentRecord(patientId: string, id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CompleteTreatmentRecordInput) =>
      api.patch<{ item: TreatmentRecord }>(`/api/treatments/${id}/complete`, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["treatments", "list", patientId] });
      void queryClient.invalidateQueries({ queryKey: ["patients", "tooth-chart", patientId] });
    },
  });
}
