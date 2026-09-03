import { AuthShell } from "@/components/layout/AuthShell";
import { AuthForm } from "@/components/auth/AuthForm";

export default function DoctorRegistrationPage() {
  return <AuthShell eyebrow="For clinicians" title="Create your doctor account" description="Register your professional details to start coordinating prescriptions with MedEasy."><AuthForm mode="doctor" /></AuthShell>;
}
