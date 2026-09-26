import { Navigate, Route, Routes } from "react-router-dom";
import { ProtectedRoute } from "./auth/ProtectedRoute.js";
import { useAuth } from "./auth/useAuth.js";
import { Layout } from "./components/Layout.js";
import { LoginPage } from "./pages/LoginPage.js";
import { SetupPage } from "./pages/SetupPage.js";
import { DashboardPage } from "./pages/DashboardPage.js";
import { NotFoundPage } from "./pages/NotFoundPage.js";
import { PatientListPage } from "./pages/patients/PatientListPage.js";
import { PatientFormPage } from "./pages/patients/PatientFormPage.js";
import { PatientDetailPage } from "./pages/patients/PatientDetailPage.js";
import { AppointmentListPage } from "./pages/appointments/AppointmentListPage.js";
import { AppointmentFormPage } from "./pages/appointments/AppointmentFormPage.js";
import { AppointmentDetailPage } from "./pages/appointments/AppointmentDetailPage.js";
import { InvoiceListPage } from "./pages/billing/InvoiceListPage.js";
import { InvoiceFormPage } from "./pages/billing/InvoiceFormPage.js";
import { InvoiceDetailPage } from "./pages/billing/InvoiceDetailPage.js";
import { StaffListPage } from "./pages/staff/StaffListPage.js";
import { AdminPage } from "./pages/admin/AdminPage.js";

// Admin is a system/operations role with no clinical access (see the ROLES
// comment in constants.ts), so the clinical dashboard is no use to it -
// send it straight to the admin panel instead.
function HomePage() {
  const { user } = useAuth();
  if (user?.role === "admin") return <Navigate to="/admin" replace />;
  return <DashboardPage />;
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/setup" element={<SetupPage />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          <Route index element={<HomePage />} />

          {/*
            Patients/appointments/billing are reachable by every signed-in
            role, admin included: admin has no create access to any of it
            (treatment notes, appointments, invoices are gated server-side,
            same as for front-desk today), but does need to reach a
            patient's Treatment notes and Files tabs to use its edit/delete
            capabilities there (see requireRole in treatments.ts/files.ts).
          */}
          <Route path="patients" element={<PatientListPage />} />
          <Route path="patients/new" element={<PatientFormPage />} />
          <Route path="patients/:id" element={<PatientDetailPage />} />
          <Route path="patients/:id/edit" element={<PatientFormPage />} />

          <Route path="appointments" element={<AppointmentListPage />} />
          <Route path="appointments/new" element={<AppointmentFormPage />} />
          <Route path="appointments/:id" element={<AppointmentDetailPage />} />
          <Route path="appointments/:id/edit" element={<AppointmentFormPage />} />

          <Route path="billing" element={<InvoiceListPage />} />
          <Route path="billing/new" element={<InvoiceFormPage />} />
          <Route path="billing/:id" element={<InvoiceDetailPage />} />

          <Route element={<ProtectedRoute roles={["admin", "doctor"]} />}>
            <Route path="staff" element={<StaffListPage />} />
          </Route>
          <Route element={<ProtectedRoute roles={["admin"]} />}>
            <Route path="admin" element={<AdminPage />} />
          </Route>

          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
