import { AuthShell } from "@/components/layout/AuthShell";
import { AuthForm } from "@/components/auth/AuthForm";

export default function PatientRegistrationPage() {
  return <AuthShell eyebrow="For patients" title="Create your patient account" description="Keep your prescription journey in view, from a doctor's desk to the pharmacy counter."><AuthForm mode="patient" /></AuthShell>;
}
