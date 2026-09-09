import { UserRole } from "@prisma/client";
import { AuthUser, authorizeRequest } from "@/lib/permissions";
import { getDoctorAnalytics } from "@/lib/doctor-service";
import { apiError, apiSuccess } from "@/lib/api-response";
import { AppError, AppErrorCode } from "@/lib/errors";

export async function getDoctorAnalyticsResponse(userOverride?: AuthUser | null) {
  try {
    const auth = await authorizeRequest({
      allowedRoles: [UserRole.DOCTOR],
      ...(userOverride !== undefined ? { userOverride } : {}),
    });
    if (auth.errorResponse) {
      return auth.errorResponse;
    }

    const analyticsData = await getDoctorAnalytics(auth.user.id);
    if ("error" in analyticsData && analyticsData.error) {
      return apiError(
        new AppError(
          analyticsData.statusCode === 404 ? AppErrorCode.NOT_FOUND : AppErrorCode.BUSINESS_RULE_ERROR,
          analyticsData.error,
          analyticsData.statusCode
        )
      );
    }

    return apiSuccess(analyticsData, 200);
  } catch (error) {
    return apiError(error, "Failed to retrieve clinical performance analytics.");
  }
}