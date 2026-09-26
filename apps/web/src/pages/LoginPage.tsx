import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { loginRequestSchema, type LoginRequest } from "@clinic/shared";
import { useAuth } from "../auth/useAuth.js";
import { useBootstrapStatus } from "../auth/useCurrentUser.js";
import { ApiError } from "../api/client.js";
import { Button, Card, FieldError, Input, Label } from "../components/ui.js";
import clinicLogo from "../assets/logo.png";

export function LoginPage() {
  const { user, login } = useAuth();
  const { data: bootstrapStatus, isPending: isCheckingSetup, refetch: retrySetup } = useBootstrapStatus();
  const navigate = useNavigate();
  const location = useLocation();

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginRequest>({ resolver: zodResolver(loginRequestSchema) });

  if (user) {
    const from = (location.state as { from?: Location } | null)?.from;
    const redirectTo = from ? `${from.pathname}${from.search ?? ""}` : "/";
    return <Navigate to={redirectTo} replace />;
  }
  if (isCheckingSetup || !bootstrapStatus) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <Card className="w-full max-w-sm text-center">
          <h1 className="text-lg font-semibold text-slate-900">Clinic Manager</h1>
          {isCheckingSetup ? (
            <p className="mt-2 text-sm text-slate-500">Checking whether this clinic needs first-time setup…</p>
          ) : (
            <>
              <p className="mt-2 text-sm text-slate-500">
                We could not check whether this clinic needs first-time setup. Check your connection and try again.
              </p>
              <Button className="mt-4" onClick={() => void retrySetup()}>Try again</Button>
            </>
          )}
        </Card>
      </div>
    );
  }
  if (bootstrapStatus?.needsBootstrap) {
    return <Navigate to="/setup" replace />;
  }

  const onSubmit = async (values: LoginRequest) => {
    try {
      await login(values);
      navigate("/", { replace: true });
    } catch (err) {
      setError("root", { message: err instanceof ApiError ? err.message : "Could not sign in. Try again." });
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <Card className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <img src={clinicLogo} alt="Clinic logo" className="mx-auto mb-3 h-14 w-14 rounded-2xl object-contain" />
          <h1 className="text-lg font-semibold text-slate-900">Clinic Manager</h1>
          <p className="text-sm text-slate-500">Dr.Sri Sushma Multispeciality Dental Clinic</p>
          <p className="mt-3 text-sm text-slate-500">
            This clinic already has an account. If you did not create it, ask the person who set up the clinic for access.
          </p>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div>
            <Label htmlFor="username">Username</Label>
            <Input id="username" autoComplete="username" autoFocus {...register("username")} />
            <FieldError>{errors.username?.message}</FieldError>
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" autoComplete="current-password" {...register("password")} />
            <FieldError>{errors.password?.message}</FieldError>
          </div>
          <FieldError>{errors.root?.message}</FieldError>
          <Button type="submit" disabled={isSubmitting} className="w-full">
            {isSubmitting ? "Signing in…" : "Sign in"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
