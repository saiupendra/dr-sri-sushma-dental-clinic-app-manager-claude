import { NavLink, Outlet } from "react-router-dom";
import { ROLE_LABELS, type Role } from "@clinic/shared";
import { useAuth } from "../auth/useAuth.js";
import { SyncStatusBadge } from "./SyncStatusBadge.js";

interface NavItem {
  to: string;
  label: string;
  end?: boolean;
  roles?: Role[];
}

const NAV_ITEMS: NavItem[] = [
  { to: "/", label: "Dashboard", end: true, roles: ["doctor", "front_desk"] },
  { to: "/patients", label: "Patients", roles: ["doctor", "front_desk"] },
  { to: "/appointments", label: "Appointments", roles: ["doctor", "front_desk"] },
  { to: "/billing", label: "Billing", roles: ["doctor", "front_desk"] },
  { to: "/staff", label: "Staff", roles: ["admin", "doctor"] },
  { to: "/admin", label: "Admin", roles: ["admin"] },
];

export function Layout() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-6">
            <span className="text-sm font-semibold text-brand-900">Clinic Manager</span>
            <nav className="hidden gap-1 sm:flex">
              {NAV_ITEMS.filter((item) => !item.roles || (!!user && item.roles.includes(user.role))).map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={"end" in item ? item.end : false}
                  className={({ isActive }) =>
                    `rounded-lg px-3 py-1.5 text-sm font-medium ${
                      isActive ? "bg-brand-50 text-brand-900" : "text-slate-600 hover:bg-slate-100"
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <SyncStatusBadge />
            <span className="hidden text-sm text-slate-500 sm:inline">
              {user?.name} · {user && ROLE_LABELS[user.role]}
            </span>
            <button
              onClick={() => void logout()}
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
            >
              Sign out
            </button>
          </div>
        </div>
        <nav className="flex gap-1 overflow-x-auto border-t border-slate-100 px-4 py-2 sm:hidden">
          {NAV_ITEMS.filter((item) => !item.roles || (!!user && item.roles.includes(user.role))).map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={"end" in item ? item.end : false}
              className={({ isActive }) =>
                `whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium ${
                  isActive ? "bg-brand-50 text-brand-900" : "text-slate-600"
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
