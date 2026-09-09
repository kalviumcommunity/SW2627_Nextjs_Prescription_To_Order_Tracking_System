import { UserRole } from "@prisma/client";
import { authorizeRequest } from "@/lib/permissions";
import { getDoctorDashboardData } from "@/lib/doctor-service";
import { apiError, apiSuccess } from "@/lib/api-response";
import { AppError, AppErrorCode } from "@/lib/errors";

export const dynamic = "force-dynamic";

/**
 * GET /api/doctor/dashboard
 * Protected endpoint returning real-time dashboard summary metrics and recent prescriptions
 * for the authenticated clinician.
 */
export async function GET() {
  try {
    // 1. Role-based authorization guard (DOCTOR only)
    const auth = await authorizeRequest({ allowedRoles: [UserRole.DOCTOR] });
    if (auth.errorResponse) {
      return auth.errorResponse;
    }

    const { user } = auth;

    // 2. Fetch live metrics and recent items filtered by doctor ownership
    const dashboardData = await getDoctorDashboardData(user.id);
    if ("error" in dashboardData && dashboardData.error) {
      return apiError(
        new AppError(
          dashboardData.statusCode === 404 ? AppErrorCode.NOT_FOUND : AppErrorCode.BUSINESS_RULE_ERROR,
          dashboardData.error,
          dashboardData.statusCode
        )
      );
    }

    return apiSuccess(dashboardData, 200);
  } catch (error) {
    return apiError(error, "Failed to retrieve doctor dashboard metrics.");
  }
}
