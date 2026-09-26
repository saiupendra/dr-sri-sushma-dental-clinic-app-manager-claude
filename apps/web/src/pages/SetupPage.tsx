import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Navigate, useNavigate } from "react-router-dom";
import { bootstrapStaffSchema, type BootstrapStaffInput } from "@clinic/shared";
import { useAuth } from "../auth/useAuth.js";
import { useBootstrapStatus } from "../auth/useCurrentUser.js";
import { ApiError } from "../api/client.js";
import { Button, Card, FieldError, Input, Label } from "../components/ui.js";

/** One-time first-run setup: creates the first doctor account. The API refuses this once any staff exists. */
export function SetupPage() {
  const { user, bootstrap } = useAuth();
  const { data: bootstrapStatus, isPending: isCheckingSetup, refetch: retrySetup } = useBootstrapStatus();
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<BootstrapStaffInput>({
    resolver: zodResolver(bootstrapStaffSchema),
  });

  if (user) return <Navigate to="/" replace />;
  if (bootstrapStatus && !bootstrapStatus.needsBootstrap) {
    return <Navigate to="/login" replace />;
  }
  if (isCheckingSetup || !bootstrapStatus) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <Card className="w-full max-w-sm text-center">
          <h1 className="text-lg font-semibold text-slate-900">First-time setup</h1>
          {isCheckingSetup ? (
            <p className="mt-2 text-sm text-slate-500">Checking whether the clinic already has an account…</p>
          ) : (
            <>
              <p className="mt-2 text-sm text-slate-500">
                We could not check whether an account already exists. Check your connection and try again.
              </p>
              <Button className="mt-4" onClick={() => void retrySetup()}>Try again</Button>
            </>
          )}
        </Card>
      </div>
    );
  }

  const onSubmit = async (values: BootstrapStaffInput) => {
    try {
      await bootstrap(values);
      navigate("/", { replace: true });
    } catch (err) {
      setError("root", { message: err instanceof ApiError ? err.message : "Could not complete setup." });
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <Card className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <h1 className="text-lg font-semibold text-slate-900">Welcome — let's set up your account</h1>
          <p className="mt-1 text-sm text-slate-500">
            This creates the first doctor account for the clinic. You can add front-desk accounts afterwards.
          </p>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div>
            <Label htmlFor="name">Your name</Label>
            <Input id="name" autoFocus {...register("name")} />
            <FieldError>{errors.name?.message}</FieldError>
          </div>
          <div>
            <Label htmlFor="username">Username</Label>
            <Input id="username" autoComplete="username" {...register("username")} />
            <FieldError>{errors.username?.message}</FieldError>
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" autoComplete="new-password" {...register("password")} />
            <FieldError>{errors.password?.message}</FieldError>
          </div>
          <FieldError>{errors.root?.message}</FieldError>
          <Button type="submit" disabled={isSubmitting} className="w-full">
            {isSubmitting ? "Setting up…" : "Create doctor account"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
