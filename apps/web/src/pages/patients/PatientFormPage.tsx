import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate, useParams } from "react-router-dom";
import { createPatientSchema, type CreatePatientInput } from "@clinic/shared";
import { usePatient, useCreatePatient, useUpdatePatient, useDeletePatient } from "../../hooks/usePatients.js";
import { useAuth } from "../../auth/useAuth.js";
import { ApiError } from "../../api/client.js";
import { Button, Card, FieldError, Input, Label, PageHeader, Select, Textarea } from "../../components/ui.js";

function SectionHeading({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-3">
      <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
      {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
    </div>
  );
}

export function PatientFormPage() {
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: existing } = usePatient(id);
  const createPatient = useCreatePatient();
  const updatePatient = useUpdatePatient(id ?? "");
  const deletePatient = useDeletePatient(id ?? "");
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function onDelete() {
    setDeleteError(null);
    if (!existing || !confirm(`Delete ${existing.name}'s record? This can't be undone.`)) return;
    try {
      await deletePatient.mutateAsync();
      navigate("/patients");
    } catch (err) {
      setDeleteError(err instanceof ApiError ? err.message : "Could not delete the patient.");
    }
  }

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CreatePatientInput>({
    resolver: zodResolver(createPatientSchema),
    defaultValues: { sex: "unspecified" },
  });

  useEffect(() => {
    if (existing) {
      reset({
        name: existing.name,
        phone: existing.phone,
        email: existing.email ?? undefined,
        dateOfBirth: existing.dateOfBirth ?? undefined,
        sex: existing.sex,
        address: existing.address ?? "",
        medicalHistoryNotes: existing.medicalHistoryNotes ?? "",
        chiefComplaint: existing.chiefComplaint ?? "",
        pastDentalHistory: existing.pastDentalHistory ?? "",
        medicationsUsing: existing.medicationsUsing ?? "",
        heightFeet: existing.heightFeet ?? undefined,
        weightKg: existing.weightKg ?? undefined,
        bloodPressure: existing.bloodPressure ?? undefined,
        bloodSugar: existing.bloodSugar ?? undefined,
        consultationFee: existing.consultationFee ?? undefined,
      });
    }
  }, [existing, reset]);

  async function onSubmit(values: CreatePatientInput) {
    try {
      if (isEdit) {
        await updatePatient.mutateAsync(values);
        navigate(`/patients/${id}`);
      } else {
        const result = await createPatient.mutateAsync(values);
        navigate(result.queued ? "/patients" : `/patients/${result.data?.item.id}`);
      }
    } catch (err) {
      setError("root", { message: err instanceof ApiError ? err.message : "Could not save the patient." });
    }
  }

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title={isEdit ? "Edit patient" : "New patient"}
        subtitle={isEdit ? undefined : "Full intake - every clinical field below is required before the record can be saved."}
      />
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
        <div className="grid gap-5 lg:grid-cols-2">
          <Card>
            <SectionHeading title="Contact details" />
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Full name</Label>
                <Input id="name" autoFocus {...register("name")} />
                <FieldError>{errors.name?.message}</FieldError>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    type="tel"
                    inputMode="numeric"
                    maxLength={10}
                    placeholder="10-digit mobile number"
                    {...register("phone")}
                  />
                  <FieldError>{errors.phone?.message}</FieldError>
                </div>
                <div>
                  <Label htmlFor="email">Email (optional)</Label>
                  <Input id="email" type="email" {...register("email")} />
                  <FieldError>{errors.email?.message}</FieldError>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="dob">Date of birth (optional)</Label>
                  <Input id="dob" type="date" {...register("dateOfBirth")} />
                </div>
                <div>
                  <Label htmlFor="sex">Sex</Label>
                  <Select id="sex" {...register("sex")}>
                    <option value="unspecified">Prefer not to say</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </Select>
                </div>
              </div>
              <div>
                <Label htmlFor="address">Address</Label>
                <Textarea id="address" rows={2} {...register("address")} />
                <FieldError>{errors.address?.message}</FieldError>
              </div>
              <div>
                <Label htmlFor="consultationFee">Consultation fee</Label>
                <Input id="consultationFee" type="number" min={0} step="1" {...register("consultationFee")} />
                <FieldError>{errors.consultationFee?.message}</FieldError>
              </div>
            </div>
          </Card>

          <Card>
            <SectionHeading title="Vitals" subtitle="Optional - fill in whatever was measured at intake." />
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="heightFeet">Height (ft)</Label>
                  <Input id="heightFeet" type="number" min={0} max={9} step="0.1" {...register("heightFeet")} />
                  <FieldError>{errors.heightFeet?.message}</FieldError>
                </div>
                <div>
                  <Label htmlFor="weightKg">Weight (kg)</Label>
                  <Input id="weightKg" type="number" min={0} max={300} step="0.1" {...register("weightKg")} />
                  <FieldError>{errors.weightKg?.message}</FieldError>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="bloodPressure">Blood pressure</Label>
                  <Input id="bloodPressure" placeholder="e.g. 120/80" {...register("bloodPressure")} />
                  <FieldError>{errors.bloodPressure?.message}</FieldError>
                </div>
                <div>
                  <Label htmlFor="bloodSugar">Blood sugar</Label>
                  <Input id="bloodSugar" placeholder="e.g. 110 mg/dL fasting" {...register("bloodSugar")} />
                  <FieldError>{errors.bloodSugar?.message}</FieldError>
                </div>
              </div>
            </div>
          </Card>
        </div>

        <Card>
          <SectionHeading title="Clinical intake" subtitle="Recorded at the first visit - all four fields are required." />
          <div className="grid gap-4 lg:grid-cols-2">
            <div>
              <Label htmlFor="chiefComplaint">Chief complaint</Label>
              <Textarea id="chiefComplaint" rows={3} placeholder="Why the patient came in today…" {...register("chiefComplaint")} />
              <FieldError>{errors.chiefComplaint?.message}</FieldError>
            </div>
            <div>
              <Label htmlFor="pastDentalHistory">Past dental history</Label>
              <Textarea
                id="pastDentalHistory"
                rows={3}
                placeholder="Previous treatments, extractions, ongoing issues…"
                {...register("pastDentalHistory")}
              />
              <FieldError>{errors.pastDentalHistory?.message}</FieldError>
            </div>
            <div>
              <Label htmlFor="medicationsUsing">Medications currently using</Label>
              <Textarea id="medicationsUsing" rows={3} placeholder="Name, dose, frequency…" {...register("medicationsUsing")} />
              <FieldError>{errors.medicationsUsing?.message}</FieldError>
            </div>
            <div>
              <Label htmlFor="medicalHistoryNotes">Medical history notes</Label>
              <Textarea
                id="medicalHistoryNotes"
                rows={3}
                placeholder="Allergies, conditions, surgeries…"
                {...register("medicalHistoryNotes")}
              />
              <FieldError>{errors.medicalHistoryNotes?.message}</FieldError>
            </div>
          </div>
        </Card>

        <FieldError>{errors.root?.message}</FieldError>
        <div className="flex gap-2">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Saving…" : "Save patient"}
          </Button>
          <Button type="button" variant="secondary" onClick={() => navigate(-1)}>
            Cancel
          </Button>
        </div>
      </form>
      {isEdit && user?.role === "admin" && (
        <Card className="mt-5 border-red-200">
          <h2 className="text-sm font-semibold text-red-800">Danger zone</h2>
          <p className="mt-1 text-sm text-slate-500">
            Permanently removes this patient from lists and search. Their appointments, treatment notes and
            invoices stay on record but the patient can no longer be found or billed.
          </p>
          <Button type="button" variant="danger" className="mt-3" onClick={() => void onDelete()} disabled={deletePatient.isPending}>
            {deletePatient.isPending ? "Deleting…" : "Delete patient"}
          </Button>
          <FieldError>{deleteError}</FieldError>
        </Card>
      )}
    </div>
  );
}
