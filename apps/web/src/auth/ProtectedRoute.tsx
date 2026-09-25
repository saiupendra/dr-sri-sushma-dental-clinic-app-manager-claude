import { Navigate, Outlet, useLocation } from "react-router-dom";
import type { Role } from "@clinic/shared";
import { useAuth } from "./useAuth.js";

export function ProtectedRoute({ roles }: { roles?: Role[] }) {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <div className="flex h-screen items-center justify-center text-slate-500">Loading…</div>;
  }
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  if (roles && !roles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }
  return <Outlet />;
}
