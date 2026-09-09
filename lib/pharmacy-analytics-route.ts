import { UserRole } from "@prisma/client";
import { AuthUser, authorizeRequest } from "@/lib/permissions";
import { getPharmacyAnalytics } from "@/lib/pharmacy-service";
import { apiError, apiSuccess, errorFromResult } from "@/lib/api-errors";

export async function getPharmacyAnalyticsResponse(userOverride?: AuthUser | null) {
  try {
    const auth = await authorizeRequest({
      allowedRoles: [UserRole.PHARMACY],
      ...(userOverride !== undefined ? { userOverride } : {}),
    });
    if (auth.errorResponse) return auth.errorResponse;

    const result = await getPharmacyAnalytics(auth.user.id);
    if ("error" in result) {
      return apiError(errorFromResult(result));
    }
    return apiSuccess(result);
  } catch (error) {
    return apiError(error, "Failed to retrieve pharmacy analytics.");
  }
}