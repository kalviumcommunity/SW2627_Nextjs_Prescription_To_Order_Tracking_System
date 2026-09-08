import { UserRole } from "@prisma/client";
import { authorizeRequest } from "@/lib/permissions";
import { getDoctorPatientsRoster } from "@/lib/doctor-service";
import { apiError, apiSuccess, errorFromResult } from "@/lib/api-errors";

export const dynamic = "force-dynamic";

/**
 * GET /api/doctor/patients
 * Protected endpoint returning only patients linked to the authenticated doctor
 * via the DoctorPatient relationship.
 */
export async function GET() {
  try {
    // 1. Role-based authorization guard (DOCTOR only)
    const auth = await authorizeRequest({ allowedRoles: [UserRole.DOCTOR] });
    if (auth.errorResponse) {
      return auth.errorResponse;
    }

    const { user } = auth;

    // 2. Fetch isolated patient roster for this doctor
    const rosterData = await getDoctorPatientsRoster(user.id);
    if ("error" in rosterData && rosterData.error) {
      return apiError(errorFromResult(rosterData));
    }

    return apiSuccess(rosterData);
  } catch (error) {
    return apiError(error, "Failed to retrieve doctor patients roster.");
  }
}
