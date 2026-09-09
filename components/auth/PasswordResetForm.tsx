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
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    if (mode === "request") {
      if (!/^\S+@\S+\.\S+$/.test(email)) {
        setError("Enter a valid email address.");
        return;
      }
      setIsLoading(true);
      try {
        const res = await fetch("/api/auth/forgot-password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: email.trim().toLowerCase() }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || "Failed to process password reset request.");
        } else {
          setSuccess(true);
          setSuccessMessage(data.message || "If an account exists with this email, password reset instructions have been sent.");
        }
      } catch {
        setError("Network error. Please check your connection and try again.");
      } finally {
        setIsLoading(false);
      }
    } else {
      if (!email.trim() || !/^\S+@\S+\.\S+$/.test(email)) {
        setError("Enter a valid email address.");
        return;
      }
      if (!token.trim()) {
        setError("Enter the reset code from your email.");
        return;
      }
      if (password.length < 8) {
        setError("Password must be at least 8 characters.");
        return;
      }
      setIsLoading(true);
      try {
        const res = await fetch("/api/auth/reset-password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: email.trim().toLowerCase(),
            token: token.trim(),
            password,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || "Failed to reset password. Please verify your reset code.");
        } else {
          setSuccess(true);
          setSuccessMessage(data.message || "Your password has been reset successfully. You can now sign in.");
        }
      } catch {
        setError("Network error. Please check your connection and try again.");
      } finally {
        setIsLoading(false);
      }
    }
  };

  return (
    <Card className="border-slate-200 shadow-[0_20px_60px_rgba(22,50,79,0.08)]">
      <CardContent className="p-6 sm:p-8">
        {success ? (
          <div role="status" className="space-y-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-xl text-emerald-700">✓</div>
            <h3 className="font-display text-2xl text-ink">{mode === "request" ? "Request received" : "Password reset successful"}</h3>
            <p className="leading-7 text-slate-600">{successMessage}</p>
            <Link href="/login" className="inline-block font-semibold text-ocean hover:text-ink">Return to sign in</Link>
          </div>
        ) : (
          <form onSubmit={submit} noValidate className="space-y-5">
            {mode === "request" ? (
              <Input
                id="reset-email"
                label="Email address"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                error={error}
                autoComplete="email"
              />
            ) : (
              <>
                <Input
                  id="reset-email"
                  label="Email address"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="email"
                />
                <Input
                  id="reset-token"
                  label="Reset code"
                  value={token}
                  onChange={(event) => setToken(event.target.value)}
                  autoComplete="one-time-code"
                />
                <Input
                  id="new-password"
                  label="New password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="new-password"
                />
                {error && <p className="text-sm text-red-500">{error}</p>}
              </>
            )}
            <Button type="submit" size="lg" className="w-full" isLoading={isLoading}>
              {mode === "request" ? "Send reset instructions" : "Set new password"}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
