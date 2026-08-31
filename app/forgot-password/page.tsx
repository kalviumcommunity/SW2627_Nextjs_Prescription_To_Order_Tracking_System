import Link from "next/link";
import { AuthShell } from "@/components/layout/AuthShell";
import { PasswordResetForm } from "@/components/auth/PasswordResetForm";

export default function ForgotPasswordPage() {
  return <AuthShell eyebrow="Account access" title="Forgot your password?" description="Enter your email and we will guide you to the next step when password recovery is available."><PasswordResetForm mode="request" /><p className="mt-6 text-center text-sm text-slate-600"><Link href="/login" className="font-semibold text-ocean hover:text-ink">Back to sign in</Link></p></AuthShell>;
}
