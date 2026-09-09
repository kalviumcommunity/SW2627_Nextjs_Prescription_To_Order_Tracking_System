import { UserRole } from "@prisma/client";
import { registerDoctor, registerPatient } from "@/lib/auth-service";
import { apiError, apiSuccess } from "@/lib/api-response";
import { ValidationError, ForbiddenError } from "@/lib/errors";
import { validateEmail, validatePassword, validateRequiredString, validateJsonBody } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await validateJsonBody<Record<string, unknown>>(req);
    const { role, email, password, ...profileData } = body;

    if (!email || !password || !role) {
      throw new ValidationError("Email, password, and role are required fields.");
    }

    const validatedEmail = validateEmail(email);
    const validatedPassword = validatePassword(password, 8);

    // Direct registration is restricted to Doctor and Patient (Pharmacy is pre-provisioned, Admin is seeded)
    if (role === UserRole.ADMIN || role === UserRole.PHARMACY) {
      throw new ForbiddenError("Direct registration for Admin and Pharmacy roles is not allowed.");
    }

    if (role === UserRole.DOCTOR) {
      const specialization = validateRequiredString(
        profileData.specialization,
        "Specialization"
      );
      const licenseNumber = validateRequiredString(
        profileData.licenseNumber,
        "licenseNumber"
      );
      const phone = validateRequiredString(profileData.phone, "phone");

      const doctor = await registerDoctor({
        email: validatedEmail,
        password: validatedPassword,
        specialization,
        licenseNumber,
        phone,
      });

      return apiSuccess(
        { message: "Doctor registered successfully.", user: doctor },
        201
      );
    }

    if (role === UserRole.PATIENT) {
      const name = validateRequiredString(profileData.name, "Name");
      if (profileData.age === undefined || profileData.age === null || profileData.age === "") {
        throw new ValidationError("Age is required for patient registration.");
      }
      const ageNum = Number(profileData.age);
      if (isNaN(ageNum) || ageNum <= 0) {
        throw new ValidationError("Age must be a valid positive number.");
      }
      const gender = validateRequiredString(profileData.gender, "Gender");
      const contactInfo = validateRequiredString(
        profileData.contactInfo,
        "ContactInfo"
      );

      const patient = await registerPatient({
        email: validatedEmail,
        password: validatedPassword,
        name,
        age: ageNum,
        gender,
        contactInfo,
      });

      return apiSuccess(
        { message: "Patient registered successfully.", user: patient },
        201
      );
    }

    throw new ValidationError(`Unsupported role: ${role}`);
  } catch (error) {
    return apiError(error, "An unexpected error occurred during registration.");
  }
}
