import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { registerDoctor, registerPatient } from "@/lib/auth-service";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { role, email, password, ...profileData } = body;

    if (!email || !password || !role) {
      return NextResponse.json(
        { error: "Email, password, and role are required fields." },
        { status: 400 }
      );
    }

    if (typeof password !== "string" || password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters long." },
        { status: 400 }
      );
    }

    // Direct registration is restricted to Doctor and Patient (Pharmacy is pre-provisioned, Admin is seeded)
    if (role === UserRole.ADMIN || role === UserRole.PHARMACY) {
      return NextResponse.json(
        { error: "Direct registration for Admin and Pharmacy roles is not allowed." },
        { status: 403 }
      );
    }

    if (role === UserRole.DOCTOR) {
      const { specialization, licenseNumber, phone } = profileData;
      if (!specialization || !licenseNumber || !phone) {
        return NextResponse.json(
          { error: "Specialization, licenseNumber, and phone are required for doctor registration." },
          { status: 400 }
        );
      }

      const doctor = await registerDoctor({
        email,
        password,
        specialization,
        licenseNumber,
        phone,
      });

      return NextResponse.json(
        { message: "Doctor registered successfully.", user: doctor },
        { status: 201 }
      );
    }

    if (role === UserRole.PATIENT) {
      const { name, age, gender, contactInfo } = profileData;
      if (!name || age === undefined || !gender || !contactInfo) {
        return NextResponse.json(
          { error: "Name, age, gender, and contactInfo are required for patient registration." },
          { status: 400 }
        );
      }

      const patient = await registerPatient({
        email,
        password,
        name,
        age: Number(age),
        gender,
        contactInfo,
      });

      return NextResponse.json(
        { message: "Patient registered successfully.", user: patient },
        { status: 201 }
      );
    }

    return NextResponse.json(
      { error: `Unsupported role: ${role}` },
      { status: 400 }
    );
  } catch (error: unknown) {
    const err = error as Error;
    console.error("Registration error:", err.message);

    if (err.message?.includes("already exists")) {
      return NextResponse.json(
        { error: err.message },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: "An unexpected error occurred during registration." },
      { status: 500 }
    );
  }
}
