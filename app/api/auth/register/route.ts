import { UserRole } from "@prisma/client";
import { registerDoctor, registerPatient } from "@/lib/auth-service";
import { apiError, apiSuccess, forbiddenError, validationError } from "@/lib/api-errors";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { role, email, password, ...profileData } = body;

    if (!email || !password || !role) {
      return apiError(validationError("Email, password, and role are required fields."));
    }

    if (typeof password !== "string" || password.length < 8) {
      return apiError(validationError("Password must be at least 8 characters long."));
    }

    // Direct registration is restricted to Doctor and Patient (Pharmacy is pre-provisioned, Admin is seeded)
    if (role === UserRole.ADMIN || role === UserRole.PHARMACY) {
      return apiError(forbiddenError("Direct registration for Admin and Pharmacy roles is not allowed."));
    }

    if (role === UserRole.DOCTOR) {
      const { specialization, licenseNumber, phone } = profileData;
      if (!specialization || !licenseNumber || !phone) {
        return apiError(validationError("Specialization, licenseNumber, and phone are required for doctor registration."));
      }

      const doctor = await registerDoctor({
        email,
        password,
        specialization,
        licenseNumber,
        phone,
      });

      return apiSuccess({ message: "Doctor registered successfully.", user: doctor }, 201);
    }

    if (role === UserRole.PATIENT) {
      const { name, age, gender, contactInfo } = profileData;
      if (!name || age === undefined || !gender || !contactInfo) {
        return apiError(validationError("Name, age, gender, and contactInfo are required for patient registration."));
      }

      const patient = await registerPatient({
        email,
        password,
        name,
        age: Number(age),
        gender,
        contactInfo,
      });

      return apiSuccess({ message: "Patient registered successfully.", user: patient }, 201);
    }

    return apiError(validationError(`Unsupported role: ${role}`));
  } catch (error: unknown) {
    return apiError(error, "An unexpected error occurred during registration.");
  }
}
