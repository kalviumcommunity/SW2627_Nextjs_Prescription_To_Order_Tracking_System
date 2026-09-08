import { UserRole } from "@prisma/client";
import { AuthUser, authorizeRequest } from "@/lib/permissions";
import { getPharmacyHistory } from "@/lib/pharmacy-service";
import { apiError, apiSuccess, errorFromResult } from "@/lib/api-errors";

export async function getPharmacyHistoryResponse(userOverride?: AuthUser | null) {
  try {
    const auth = await authorizeRequest({
      allowedRoles: [UserRole.PHARMACY],
      ...(userOverride !== undefined ? { userOverride } : {}),
    });
    if (auth.errorResponse) return auth.errorResponse;

    const result = await getPharmacyHistory(auth.user.id);
    if ("error" in result) {
      return apiError(errorFromResult(result));
    }
    return apiSuccess(result);
  } catch (error) {
    return apiError(error, "Failed to retrieve pharmacy history.");
  }
}