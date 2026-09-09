import { UserRole } from "@prisma/client";
import { authorizeRequest } from "@/lib/permissions";
import { getPharmacyDashboardData } from "@/lib/pharmacy-service";
import { apiError, apiSuccess } from "@/lib/api-response";
import { AppError, AppErrorCode } from "@/lib/errors";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const auth = await authorizeRequest({ allowedRoles: [UserRole.PHARMACY] });
    if (auth.errorResponse) return auth.errorResponse;

    const result = await getPharmacyDashboardData(auth.user.id);
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
    return apiError(error, "Failed to retrieve pharmacy dashboard metrics.");
  }
}