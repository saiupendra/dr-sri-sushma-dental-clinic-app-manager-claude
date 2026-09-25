import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate, useParams } from "react-router-dom";
import { createPatientSchema, type CreatePatientInput } from "@clinic/shared";
import { usePatient, useCreatePatient, useUpdatePatient } from "../../hooks/usePatients.js";
import { ApiError } from "../../api/client.js";
import { Button, Card, FieldError, Input, Label, PageHeader, Select, Textarea } from "../../components/ui.js";

export function PatientFormPage() {
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;
  const navigate = useNavigate();
  const { data: existing } = usePatient(id);
  const createPatient = useCreatePatient();
  const updatePatient = useUpdatePatient(id ?? "");

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
    <div className="mx-auto max-w-lg">
      <PageHeader title={isEdit ? "Edit patient" : "New patient"} />
      <Card>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
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
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="heightFeet">Height (ft, optional)</Label>
              <Input id="heightFeet" type="number" min={0} max={9} step="0.1" {...register("heightFeet")} />
              <FieldError>{errors.heightFeet?.message}</FieldError>
            </div>
            <div>
              <Label htmlFor="weightKg">Weight (kg, optional)</Label>
              <Input id="weightKg" type="number" min={0} max={300} step="0.1" {...register("weightKg")} />
              <FieldError>{errors.weightKg?.message}</FieldError>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="bloodPressure">Blood pressure (optional)</Label>
              <Input id="bloodPressure" placeholder="e.g. 120/80" {...register("bloodPressure")} />
              <FieldError>{errors.bloodPressure?.message}</FieldError>
            </div>
            <div>
              <Label htmlFor="bloodSugar">Blood sugar (optional)</Label>
              <Input id="bloodSugar" placeholder="e.g. 110 mg/dL fasting" {...register("bloodSugar")} />
              <FieldError>{errors.bloodSugar?.message}</FieldError>
            </div>
          </div>
          <div>
            <Label htmlFor="consultationFee">Consultation fee (optional)</Label>
            <Input id="consultationFee" type="number" min={0} step="1" {...register("consultationFee")} />
            <FieldError>{errors.consultationFee?.message}</FieldError>
          </div>
          <div>
            <Label htmlFor="address">Address</Label>
            <Textarea id="address" rows={2} {...register("address")} />
            <FieldError>{errors.address?.message}</FieldError>
          </div>
          <div>
            <Label htmlFor="medicalHistoryNotes">Medical history notes</Label>
            <Textarea
              id="medicalHistoryNotes"
              rows={3}
              placeholder="Allergies, conditions, medications…"
              {...register("medicalHistoryNotes")}
            />
            <FieldError>{errors.medicalHistoryNotes?.message}</FieldError>
          </div>
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
      </Card>
    </div>
  );
}
