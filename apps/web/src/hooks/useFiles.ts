import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { FileRecord, FileType } from "@clinic/shared";
import { api, apiRequest } from "../api/client.js";

// File uploads need a live connection (binary bytes aren't queued in the
// offline outbox) — see docs/architecture.md "Known limitations".

export function useFilesList(patientId: string | undefined) {
  return useQuery({
    queryKey: ["files", "list", patientId],
    queryFn: () => api.get<{ items: FileRecord[] }>(`/api/files?patientId=${patientId}`).then((r) => r.items),
    enabled: !!patientId,
  });
}

export interface UploadFileInput {
  patientId: string;
  type: FileType;
  notes?: string;
  file: File;
}

export function useUploadFile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ patientId, type, notes, file }: UploadFileInput) => {
      const form = new FormData();
      form.set("patientId", patientId);
      form.set("type", type);
      if (notes) form.set("notes", notes);
      form.set("file", file);
      return apiRequest<{ item: FileRecord }>("POST", "/api/files", form);
    },
    onSuccess: (_data, vars) => {
      void queryClient.invalidateQueries({ queryKey: ["files", "list", vars.patientId] });
    },
  });
}

export function useDeleteFile(patientId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (fileId: string) => api.delete(`/api/files/${fileId}`),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["files", "list", patientId] }),
  });
}

export function fileDownloadUrl(fileId: string): string {
  return `${import.meta.env.VITE_API_URL as string}/api/files/${fileId}/download`;
}
