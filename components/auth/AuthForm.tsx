'use client';

import Link from "next/link";
import { FormEvent, useState } from "react";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";

type AuthMode = "login" | "doctor" | "patient";
type FormValues = Record<string, string>;
type FormErrors = Record<string, string>;

const fieldLabels: Record<string, string> = {
  name: "Full name",
  email: "Email address",
  password: "Password",
  specialization: "Specialization",
  licenseNumber: "License number",
  phone: "Phone number",
  age: "Age",
  contactInfo: "Phone or contact information",
};

const requiredFields: Record<AuthMode, string[]> = {
  login: ["email", "password"],
  doctor: ["name", "email", "password", "specialization", "licenseNumber", "phone"],
  patient: ["name", "email", "password", "age", "gender", "contactInfo"],
};

export function AuthForm({ mode }: { mode: AuthMode }) {
  const [values, setValues] = useState<FormValues>({ gender: "" });
  const [errors, setErrors] = useState<FormErrors>({});
  const [status, setStatus] = useState<"idle" | "loading" | "error" | "success">("idle");
  const [message, setMessage] = useState("");

  const updateValue = (name: string, value: string) => {
    setValues((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: "" }));
    setStatus("idle");
    setMessage("");
  };

  const validate = () => {
    const nextErrors: FormErrors = {};
    for (const field of requiredFields[mode]) {
      if (!values[field]?.trim()) nextErrors[field] = `${fieldLabels[field]} is required.`;
    }
    if (values.email && !/^\S+@\S+\.\S+$/.test(values.email)) nextErrors.email = "Enter a valid email address.";
    if (values.password && values.password.length < 8) nextErrors.password = "Password must be at least 8 characters.";
    if (mode === "patient" && values.age && (!Number.isInteger(Number(values.age)) || Number(values.age) < 0 || Number(values.age) > 125)) {
      nextErrors.age = "Enter an age between 0 and 125.";
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!validate()) {
      setStatus("error");
      setMessage("Please correct the highlighted fields.");
      return;
    }

    setStatus("loading");
    setMessage("");
    if (mode === "login") {
      const result = await signIn("credentials", { email: values.email, password: values.password, redirect: false });
      if (result?.error) {
        setStatus("error");
        setMessage("We could not sign you in with those details.");
      } else {
        setStatus("success");
        setMessage("You are signed in successfully.");
      }
      return;
    }

    const response = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        role: mode === "doctor" ? "DOCTOR" : "PATIENT",
        ...values,
        age: mode === "patient" ? Number(values.age) : undefined,
      }),
    });
    const result = await response.json();
    if (!response.ok) {
      setStatus("error");
      setMessage(result.error || "Registration could not be completed.");
    } else {
      setStatus("success");
      setMessage("Your account is ready. You can sign in now.");
    }
  };

  const fields = mode === "login"
    ? ["email", "password"]
    : mode === "doctor"
      ? ["name", "email", "password", "specialization", "licenseNumber", "phone"]
      : ["name", "email", "password", "age", "gender", "contactInfo"];

  return (
    <Card className="border-slate-200 shadow-[0_20px_60px_rgba(22,50,79,0.08)]">
      <CardContent className="p-6 sm:p-8">
        <form onSubmit={handleSubmit} noValidate className="space-y-5">
          {fields.map((field) => field === "gender" ? (
            <div key={field} className="flex w-full flex-col">
              <label htmlFor="gender" className="mb-1 text-sm font-medium text-gray-700">Gender</label>
              <select id="gender" value={values.gender || ""} onChange={(event) => updateValue("gender", event.target.value)} className={`h-10 rounded-md border bg-white px-3 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.gender ? "border-red-500 focus:ring-red-500" : "border-gray-300"}`}>
                <option value="">Select gender</option>
                <option value="Female">Female</option>
                <option value="Male">Male</option>
                <option value="Other">Other</option>
                <option value="Prefer not to say">Prefer not to say</option>
              </select>
              {errors.gender && <p className="mt-1 text-sm text-red-500">{errors.gender}</p>}
            </div>
          ) : (
            <Input key={field} id={field} label={fieldLabels[field]} type={field === "password" ? "password" : field === "age" ? "number" : field === "email" ? "email" : "text"} value={values[field] || ""} onChange={(event) => updateValue(field, event.target.value)} error={errors[field]} autoComplete={field === "password" ? (mode === "login" ? "current-password" : "new-password") : field === "email" ? "email" : "off"} />
          ))}
          {mode === "login" && <div className="text-right"><Link href="/forgot-password" className="text-sm font-semibold text-ocean hover:text-ink">Forgot password?</Link></div>}
          {message && <div role="status" className={`rounded-md border px-4 py-3 text-sm ${status === "error" ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>{message}</div>}
          <Button type="submit" size="lg" className="w-full" isLoading={status === "loading"} disabled={status === "success"}>{mode === "login" ? "Sign in" : "Create account"}</Button>
        </form>
        <div className="mt-7 border-t border-slate-100 pt-6 text-center text-sm text-slate-600">
          {mode === "login" ? <><span>New to MedEasy?</span> <Link href="/register/patient" className="font-semibold text-ocean hover:text-ink">Patient registration</Link> <span className="mx-1">or</span> <Link href="/register/doctor" className="font-semibold text-ocean hover:text-ink">Doctor registration</Link></> : <><span>Already have an account?</span> <Link href="/login" className="font-semibold text-ocean hover:text-ink">Sign in</Link></>}
        </div>
      </CardContent>
    </Card>
  );
}
