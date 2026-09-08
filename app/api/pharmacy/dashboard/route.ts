import { UserRole } from "@prisma/client";
import { authorizeRequest } from "@/lib/permissions";
import { getPharmacyDashboardData } from "@/lib/pharmacy-service";
import { apiError, apiSuccess, errorFromResult } from "@/lib/api-errors";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const auth = await authorizeRequest({ allowedRoles: [UserRole.PHARMACY] });
    if (auth.errorResponse) return auth.errorResponse;

    const result = await getPharmacyDashboardData(auth.user.id);
    if ("error" in result) {
      return apiError(errorFromResult(result));
    }
    return apiSuccess(result);
  } catch (error) {
    console.error("Error fetching pharmacy dashboard:", error);
    return apiError(error, "Failed to retrieve pharmacy dashboard metrics.");
  }
}