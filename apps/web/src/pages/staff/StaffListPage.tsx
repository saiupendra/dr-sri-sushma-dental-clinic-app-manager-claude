import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createStaffSchema, type CreateStaffInput } from "@clinic/shared";
import { useCreateStaff, useResetStaffPassword, useStaffList, useUpdateStaff } from "../../hooks/useStaff.js";
import { ApiError } from "../../api/client.js";
import { Badge, Button, Card, FieldError, Input, Label, PageHeader, Select } from "../../components/ui.js";

export function StaffListPage() {
  const [showForm, setShowForm] = useState(false);
  const { data: staffList, isLoading } = useStaffList();

  return (
    <div className="space-y-4">
      <PageHeader
        title="Staff accounts"
        action={<Button onClick={() => setShowForm((v) => !v)}>{showForm ? "Close" : "+ Add staff"}</Button>}
      />
      {showForm && <NewStaffForm onSaved={() => setShowForm(false)} />}
      <Card>
        {isLoading && <p className="text-sm text-slate-400">Loading…</p>}
        <ul className="divide-y divide-slate-100">
          {staffList?.map((member) => (
            <StaffRow key={member.id} staff={member} />
          ))}
        </ul>
      </Card>
    </div>
  );
}

function NewStaffForm({ onSaved }: { onSaved: () => void }) {
  const createStaff = useCreateStaff();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CreateStaffInput>({ resolver: zodResolver(createStaffSchema), defaultValues: { role: "front_desk" } });

  async function onSubmit(values: CreateStaffInput) {
    try {
      await createStaff.mutateAsync(values);
      onSaved();
    } catch (err) {
      setError("root", { message: err instanceof ApiError ? err.message : "Could not create the account." });
    }
  }

  return (
    <Card>
      <form onSubmit={handleSubmit(onSubmit)} className="grid gap-3 sm:grid-cols-2" noValidate>
        <div>
          <Label htmlFor="name">Name</Label>
          <Input id="name" {...register("name")} />
          <FieldError>{errors.name?.message}</FieldError>
        </div>
        <div>
          <Label htmlFor="role">Role</Label>
          <Select id="role" {...register("role")}>
            <option value="front_desk">Front desk</option>
            <option value="doctor">Doctor</option>
          </Select>
        </div>
        <div>
          <Label htmlFor="username">Username</Label>
          <Input id="username" {...register("username")} />
          <FieldError>{errors.username?.message}</FieldError>
        </div>
        <div>
          <Label htmlFor="password">Temporary password</Label>
          <Input id="password" type="password" {...register("password")} />
          <FieldError>{errors.password?.message}</FieldError>
        </div>
        <div className="sm:col-span-2">
          <FieldError>{errors.root?.message}</FieldError>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Creating…" : "Create account"}
          </Button>
        </div>
      </form>
    </Card>
  );
}

function StaffRow({ staff }: { staff: { id: string; name: string; username: string; role: string; isActive: boolean } }) {
  const [resetting, setResetting] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const updateStaff = useUpdateStaff(staff.id);
  const resetPassword = useResetStaffPassword(staff.id);

  return (
    <li className="py-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-medium text-slate-900">
            {staff.name} <span className="font-normal text-slate-400">@{staff.username}</span>
          </p>
          <div className="mt-1 flex gap-2">
            <Badge tone="brand">{staff.role === "doctor" ? "Doctor" : "Front desk"}</Badge>
            <Badge tone={staff.isActive ? "green" : "red"}>{staff.isActive ? "Active" : "Deactivated"}</Badge>
          </div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" onClick={() => setResetting((v) => !v)}>
            Reset password
          </Button>
          <Button
            size="sm"
            variant={staff.isActive ? "danger" : "secondary"}
            onClick={() => updateStaff.mutate({ isActive: !staff.isActive })}
          >
            {staff.isActive ? "Deactivate" : "Reactivate"}
          </Button>
        </div>
      </div>
      {resetting && (
        <div className="mt-3 flex items-end gap-2">
          <div className="flex-1">
            <Label htmlFor={`pw-${staff.id}`}>New password</Label>
            <Input id={`pw-${staff.id}`} type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
          </div>
          <Button
            size="sm"
            onClick={() => {
              resetPassword.mutate(newPassword, {
                onSuccess: () => {
                  setResetting(false);
                  setNewPassword("");
                },
              });
            }}
            disabled={newPassword.length < 8 || resetPassword.isPending}
          >
            Set password
          </Button>
        </div>
      )}
    </li>
  );
}
