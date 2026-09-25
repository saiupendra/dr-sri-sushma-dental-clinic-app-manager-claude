import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { BackupSummary, SessionSummary, StorageStats } from "@clinic/shared";
import { api } from "../api/client.js";

export function useActiveSessions() {
  return useQuery({
    queryKey: ["admin", "sessions"],
    queryFn: () => api.get<{ items: SessionSummary[] }>("/api/admin/sessions").then((r) => r.items),
  });
}

export function useRevokeSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (sessionId: string) => api.delete(`/api/admin/sessions/${sessionId}`),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["admin", "sessions"] }),
  });
}

export function useStorageStats() {
  return useQuery({
    queryKey: ["admin", "storage"],
    queryFn: () => api.get<StorageStats>("/api/admin/storage"),
  });
}

export function adminExportUrl(): string {
  return `${import.meta.env.VITE_API_URL as string}/api/admin/export`;
}

export function useBackupsList() {
  return useQuery({
    queryKey: ["admin", "backups"],
    queryFn: () => api.get<{ items: BackupSummary[] }>("/api/admin/backups").then((r) => r.items),
  });
}

export function backupDownloadUrl(date: string): string {
  return `${import.meta.env.VITE_API_URL as string}/api/admin/backups/${date}/download`;
}

/** Triggers an out-of-band backup right now instead of waiting for the nightly cron - see POST /api/internal/backup. */
export function useTriggerBackup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<{ ok: boolean; key: string; sizeBytes: number }>("/api/internal/backup"),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["admin", "backups"] }),
  });
}
