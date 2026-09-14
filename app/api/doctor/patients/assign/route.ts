import { UserRole } from "@prisma/client";
import { authorizeRequest, getDoctorProfileByUserId } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { apiError, apiSuccess, conflictError, notFoundError, validationError } from "@/lib/api-errors";

export const dynamic = "force-dynamic";

/**
 * POST /api/doctor/patients/assign
 * Assigns an existing patient to the authenticated doctor's care roster
 * by creating a DoctorPatient join record.
 *
 * Body: { patientId: string }
 *
 * Returns the newly assigned patient profile on success.
 * Returns 409 if the patient is already on this doctor's roster.
 */
export async function POST(request: Request) {
  try {
    const auth = await authorizeRequest({ allowedRoles: [UserRole.DOCTOR] });
    if (auth.errorResponse) return auth.errorResponse;

    const doctorProfile = await getDoctorProfileByUserId(auth.user.id);
    if (!doctorProfile) {
      return apiError(notFoundError("Doctor profile not found."));
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return apiError(validationError("Invalid request body. Expected JSON object."));
    }

    const { patientId } = body as { patientId?: unknown };

    if (!patientId || typeof patientId !== "string" || !patientId.trim()) {
      return apiError(validationError("patientId is required."));
    }

    const trimmedPatientId = patientId.trim();

    // Verify the patient exists
    const patientProfile = await prisma.patientProfile.findUnique({
      where: { id: trimmedPatientId },
      select: { id: true, name: true, age: true, gender: true, contactInfo: true, createdAt: true },
    });

    if (!patientProfile) {
      return apiError(notFoundError("Patient not found."));
    }

    // Check if already assigned (prevent duplicate)
    const existingLink = await prisma.doctorPatient.findUnique({
      where: {
        doctorId_patientId: {
          doctorId: doctorProfile.id,
          patientId: trimmedPatientId,
        },
      },
    });

    if (existingLink) {
      return apiError(conflictError("This patient is already on your care roster."));
    }

    // Create the DoctorPatient relationship
    await prisma.doctorPatient.create({
      data: {
        doctorId: doctorProfile.id,
        patientId: trimmedPatientId,
      },
    });

    return apiSuccess({
      message: "Patient successfully assigned to your care roster.",
      patient: patientProfile,
    });
  } catch (error) {
    return apiError(error, "Failed to assign patient to roster.");
  }
}
