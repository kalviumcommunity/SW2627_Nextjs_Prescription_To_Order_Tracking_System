import { UserRole } from "@prisma/client";
import { registerDoctor, registerPatient } from "@/lib/auth-service";
import { apiError, apiSuccess, forbiddenError, validationError } from "@/lib/api-errors";

export const dynamic = "force-dynamic";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return apiError(validationError("Invalid request payload. Expected JSON object."));
    }

    const { role, email, password } = body as Record<string, unknown>;

    if (!email || typeof email !== "string" || !email.trim()) {
      return apiError(validationError("A valid email address is required."));
    }

    const trimmedEmail = email.toLowerCase().trim();
    if (!EMAIL_REGEX.test(trimmedEmail)) {
      return apiError(validationError("Invalid email format. Please provide a valid email address."));
    }

    if (!password || typeof password !== "string" || password.length < 8) {
      return apiError(validationError("Password must be at least 8 characters long."));
    }

    if (!role || typeof role !== "string") {
      return apiError(validationError("Role is required."));
    }

    // Direct registration is restricted to Doctor and Patient (Pharmacy is pre-provisioned, Admin is seeded)
    if (role === UserRole.ADMIN || role === UserRole.PHARMACY) {
      return apiError(forbiddenError("Direct registration for Admin and Pharmacy roles is not allowed."));
    }

    if (role === UserRole.DOCTOR) {
      const specialization = typeof body.specialization === "string" ? body.specialization.trim() : "";
      const licenseNumber = typeof body.licenseNumber === "string" ? body.licenseNumber.trim() : "";
      const phone = typeof body.phone === "string" ? body.phone.trim() : "";

      if (!specialization || !licenseNumber || !phone) {
        return apiError(
          validationError("Specialization, licenseNumber, and phone are required for doctor registration.")
        );
      }

      const doctor = await registerDoctor({
        email: trimmedEmail,
        password,
        specialization,
        licenseNumber,
        phone,
      });

      return apiSuccess({ message: "Doctor registered successfully.", user: doctor }, 201);
    }

    if (role === UserRole.PATIENT) {
      const name = typeof body.name === "string" ? body.name.trim() : "";
      const gender = typeof body.gender === "string" ? body.gender.trim() : "";
      const contactInfo = typeof body.contactInfo === "string" ? body.contactInfo.trim() : "";
      const rawAge = body.age;

      const parsedAge = typeof rawAge === "number" ? rawAge : Number(rawAge);
      if (
        rawAge === undefined ||
        rawAge === null ||
        !Number.isInteger(parsedAge) ||
        parsedAge < 1 ||
        parsedAge > 130
      ) {
        return apiError(validationError("Age must be a valid positive integer between 1 and 130."));
      }

      if (!name || !gender || !contactInfo) {
        return apiError(
          validationError("Name, age, gender, and contactInfo are required for patient registration.")
        );
      }

      const patient = await registerPatient({
        email: trimmedEmail,
        password,
        name,
        age: parsedAge,
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
