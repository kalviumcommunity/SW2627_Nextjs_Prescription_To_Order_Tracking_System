import { UserRole } from "@prisma/client";
import { authorizeRequest, getDoctorProfileByUserId } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { apiError, apiSuccess, notFoundError } from "@/lib/api-errors";

export const dynamic = "force-dynamic";

/**
 * GET /api/doctor/patients/available
 * Returns all patient profiles NOT yet assigned to the authenticated doctor's roster.
 * Used to populate the "Assign Patient" modal dropdown on the Doctor Patients page.
 */
export async function GET() {
  try {
    const auth = await authorizeRequest({ allowedRoles: [UserRole.DOCTOR] });
    if (auth.errorResponse) return auth.errorResponse;

    const doctorProfile = await getDoctorProfileByUserId(auth.user.id);
    if (!doctorProfile) {
      return apiError(notFoundError("Doctor profile not found."));
    }

    // Find IDs of patients already on this doctor's roster
    const existingLinks = await prisma.doctorPatient.findMany({
      where: { doctorId: doctorProfile.id },
      select: { patientId: true },
    });

    const assignedPatientIds = existingLinks.map((link) => link.patientId);

    // Return all patients NOT in that set
    const availablePatients = await prisma.patientProfile.findMany({
      where: {
        id: { notIn: assignedPatientIds.length > 0 ? assignedPatientIds : [] },
      },
      select: {
        id: true,
        name: true,
        age: true,
        gender: true,
        contactInfo: true,
      },
      orderBy: { name: "asc" },
    });

    return apiSuccess({ patients: availablePatients });
  } catch (error) {
    return apiError(error, "Failed to retrieve available patients.");
  }
}
