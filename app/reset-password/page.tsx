import Link from "next/link";
import { AuthShell } from "@/components/layout/AuthShell";
import { PasswordResetForm } from "@/components/auth/PasswordResetForm";

export default function ResetPasswordPage() {
  return <AuthShell eyebrow="Account access" title="Set a new password" description="Use the reset code from your recovery email to choose a new password."><PasswordResetForm mode="reset" /><p className="mt-6 text-center text-sm text-slate-600"><Link href="/login" className="font-semibold text-ocean hover:text-ink">Back to sign in</Link></p></AuthShell>;
}
