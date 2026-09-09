import { UserRole } from "@prisma/client";
import { AuthUser, authorizeRequest } from "@/lib/permissions";
import { getDoctorAnalytics } from "@/lib/doctor-service";
import { apiError, apiSuccess, errorFromResult } from "@/lib/api-errors";

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
      return apiError(errorFromResult(analyticsData));
    }

    return apiSuccess(analyticsData);
  } catch (error) {
    return apiError(error, "Failed to retrieve clinical performance analytics.");
  }
}