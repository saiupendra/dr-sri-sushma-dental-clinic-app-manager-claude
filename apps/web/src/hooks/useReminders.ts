import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Reminder } from "@clinic/shared";
import { api } from "../api/client.js";

// Sending a reminder inherently needs a live connection (it opens WhatsApp
// with the patient's current number), so this never queues offline.

export function useRemindersList(appointmentId: string | undefined) {
  return useQuery({
    queryKey: ["reminders", "list", appointmentId],
    queryFn: () =>
      api.get<{ items: Reminder[] }>(`/api/reminders?appointmentId=${appointmentId}`).then((r) => r.items),
    enabled: !!appointmentId,
  });
}

export function useSendReminder(appointmentId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api.post<{ reminder: Reminder; whatsappUrl: string }>("/api/reminders", { appointmentId }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["reminders", "list", appointmentId] }),
  });
}

export function useMarkReminderSent(appointmentId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (reminderId: string) => api.patch<{ item: Reminder }>(`/api/reminders/${reminderId}/sent`, {}),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["reminders", "list", appointmentId] }),
  });
}
