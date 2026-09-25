import { useQuery } from "@tanstack/react-query";
import type { StaffPublic } from "@clinic/shared";
import { api, ApiError } from "../api/client.js";

export function useCurrentUser() {
  return useQuery({
    queryKey: ["auth", "me"],
    queryFn: async (): Promise<StaffPublic | null> => {
      try {
        const res = await api.get<{ user: StaffPublic }>("/api/auth/me");
        return res.user;
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) return null;
        throw err;
      }
    },
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}

export function useBootstrapStatus() {
  return useQuery({
    queryKey: ["auth", "bootstrap-status"],
    queryFn: () => api.get<{ needsBootstrap: boolean }>("/api/auth/bootstrap-status"),
    staleTime: 60 * 1000,
    retry: false,
  });
}
