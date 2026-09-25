import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CreateStaffInput, StaffPublic, UpdateStaffInput } from "@clinic/shared";
import { api } from "../api/client.js";

export function useStaffList() {
  return useQuery({
    queryKey: ["staff", "list"],
    queryFn: () => api.get<{ items: StaffPublic[] }>("/api/staff").then((r) => r.items),
  });
}

export function useCreateStaff() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateStaffInput) => api.post<{ item: StaffPublic }>("/api/staff", input),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["staff", "list"] }),
  });
}

export function useUpdateStaff(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateStaffInput) => api.patch<{ item: StaffPublic }>(`/api/staff/${id}`, input),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["staff", "list"] }),
  });
}

export function useResetStaffPassword(id: string) {
  return useMutation({
    mutationFn: (password: string) => api.post(`/api/staff/${id}/reset-password`, { password }),
  });
}
