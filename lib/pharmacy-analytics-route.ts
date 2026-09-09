import { UserRole } from "@prisma/client";
import { AuthUser, authorizeRequest } from "@/lib/permissions";
import { getPharmacyAnalytics } from "@/lib/pharmacy-service";
import { apiError, apiSuccess } from "@/lib/api-response";
import { AppError, AppErrorCode } from "@/lib/errors";

export async function getPharmacyAnalyticsResponse(userOverride?: AuthUser | null) {
  try {
    const auth = await authorizeRequest({
      allowedRoles: [UserRole.PHARMACY],
      ...(userOverride !== undefined ? { userOverride } : {}),
    });
    if (auth.errorResponse) return auth.errorResponse;

    const result = await getPharmacyAnalytics(auth.user.id);
    if ("error" in result) {
      return apiError(
        new AppError(
          result.statusCode === 404 ? AppErrorCode.NOT_FOUND : AppErrorCode.BUSINESS_RULE_ERROR,
          result.error,
          result.statusCode
        )
      );
    }
    return apiSuccess(result, 200);
  } catch (error) {
    return apiError(error, "Failed to retrieve pharmacy analytics.");
  }
}