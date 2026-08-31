'use client';

import Link from "next/link";
import { FormEvent, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";

export function PasswordResetForm({ mode }: { mode: "request" | "reset" }) {
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    if (mode === "request" && !/^\S+@\S+\.\S+$/.test(email)) {
      setError("Enter a valid email address.");
      return;
    }
    if (mode === "reset" && (!token.trim() || password.length < 8)) {
      setError(!token.trim() ? "Enter the reset code from your email." : "Password must be at least 8 characters.");
      return;
    }
    setSuccess(true);
  };

  return (
    <Card className="border-slate-200 shadow-[0_20px_60px_rgba(22,50,79,0.08)]">
      <CardContent className="p-6 sm:p-8">
        {success ? (
          <div role="status" className="space-y-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-xl text-emerald-700">✓</div>
            <h3 className="font-display text-2xl text-ink">Request received</h3>
            <p className="leading-7 text-slate-600">The password reset service is not connected in this release. Your details were not stored.</p>
            <Link href="/login" className="inline-block font-semibold text-ocean hover:text-ink">Return to sign in</Link>
          </div>
        ) : (
          <form onSubmit={submit} noValidate className="space-y-5">
            {mode === "request" ? <Input id="reset-email" label="Email address" type="email" value={email} onChange={(event) => setEmail(event.target.value)} error={error} autoComplete="email" /> : <><Input id="reset-token" label="Reset code" value={token} onChange={(event) => setToken(event.target.value)} error={error} autoComplete="one-time-code" /><Input id="new-password" label="New password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" /></>}
            {error && mode === "reset" && <p className="text-sm text-red-500">{error}</p>}
            <Button type="submit" size="lg" className="w-full">{mode === "request" ? "Send reset instructions" : "Set new password"}</Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
