import { createContext, type ReactNode } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { BootstrapStaffInput, LoginRequest, StaffPublic } from "@clinic/shared";
import { api } from "../api/client.js";
import { useCurrentUser } from "./useCurrentUser.js";

export interface AuthContextValue {
  user: StaffPublic | null;
  isLoading: boolean;
  login: (input: LoginRequest) => Promise<void>;
  logout: () => Promise<void>;
  bootstrap: (input: BootstrapStaffInput) => Promise<void>;
}

// eslint-disable-next-line react-refresh/only-export-components -- context lives beside its provider on purpose; see useAuth.ts
export const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const { data: user, isLoading } = useCurrentUser();

  const loginMutation = useMutation({
    mutationFn: (input: LoginRequest) => api.post<{ user: StaffPublic }>("/api/auth/login", input),
    onSuccess: (res) => queryClient.setQueryData(["auth", "me"], res.user),
  });

  const bootstrapMutation = useMutation({
    mutationFn: (input: BootstrapStaffInput) => api.post<{ user: StaffPublic }>("/api/auth/bootstrap", input),
    onSuccess: (res) => queryClient.setQueryData(["auth", "me"], res.user),
  });

  const logoutMutation = useMutation({
    mutationFn: () => api.post("/api/auth/logout"),
    onSuccess: () => {
      queryClient.setQueryData(["auth", "me"], null);
      queryClient.clear();
    },
  });

  return (
    <AuthContext.Provider
      value={{
        user: user ?? null,
        isLoading,
        login: async (input) => {
          await loginMutation.mutateAsync(input);
        },
        logout: async () => {
          await logoutMutation.mutateAsync();
        },
        bootstrap: async (input) => {
          await bootstrapMutation.mutateAsync(input);
        },
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
