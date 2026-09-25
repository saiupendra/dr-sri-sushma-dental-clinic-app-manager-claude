import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { loginRequestSchema, type LoginRequest } from "@clinic/shared";
import { useAuth } from "../auth/useAuth.js";
import { useBootstrapStatus } from "../auth/useCurrentUser.js";
import { ApiError } from "../api/client.js";
import { Button, Card, FieldError, Input, Label } from "../components/ui.js";

export function LoginPage() {
  const { user, login } = useAuth();
  const { data: bootstrapStatus } = useBootstrapStatus();
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
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-900 text-lg font-semibold text-white">
            +
          </div>
          <h1 className="text-lg font-semibold text-slate-900">Clinic Manager</h1>
          <p className="text-sm text-slate-500">Dr.Sri Sushma Multispeciality Dental Clinic</p>
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
