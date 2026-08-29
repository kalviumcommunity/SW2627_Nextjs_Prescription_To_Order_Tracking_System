import { AuthShell } from "@/components/layout/AuthShell";
import { AuthForm } from "@/components/auth/AuthForm";

export default function LoginPage() {
  return <AuthShell eyebrow="Welcome back" title="Sign in to MedEasy" description="Access the prescription and order updates that matter to your care team."><AuthForm mode="login" /></AuthShell>;
}
