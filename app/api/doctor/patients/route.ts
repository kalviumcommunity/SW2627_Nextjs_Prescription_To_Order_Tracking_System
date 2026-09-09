import { UserRole } from "@prisma/client";
import { authorizeRequest } from "@/lib/permissions";
import { getDoctorPatientsRoster } from "@/lib/doctor-service";
import { apiError, apiSuccess } from "@/lib/api-response";
import { AppError, AppErrorCode } from "@/lib/errors";

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
      return apiError(
        new AppError(
          rosterData.statusCode === 404 ? AppErrorCode.NOT_FOUND : AppErrorCode.BUSINESS_RULE_ERROR,
          rosterData.error,
          rosterData.statusCode
        )
      );
    }

    return apiSuccess(rosterData, 200);
  } catch (error) {
    return apiError(error, "Failed to retrieve doctor patients roster.");
  }
}
