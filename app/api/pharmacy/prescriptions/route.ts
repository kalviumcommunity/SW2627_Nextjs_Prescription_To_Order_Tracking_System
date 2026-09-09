import { PrescriptionStatus, UserRole } from "@prisma/client";
import { authorizeRequest } from "@/lib/permissions";
import { getPharmacyPrescriptions } from "@/lib/pharmacy-service";
import { apiError, apiSuccess } from "@/lib/api-response";
import { AppError, AppErrorCode, ValidationError } from "@/lib/errors";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const auth = await authorizeRequest({ allowedRoles: [UserRole.PHARMACY] });
    if (auth.errorResponse) return auth.errorResponse;

    const searchParams = new URL(request.url).searchParams;
    const hasStatus = searchParams.has("status");
    const statusValue = searchParams.get("status");
    if (hasStatus && (!statusValue || !Object.values(PrescriptionStatus).includes(statusValue as PrescriptionStatus))) {
      throw new ValidationError("Invalid status. Use PENDING, FILLED, or CANNOT_FILL.");
    }

    const result = await getPharmacyPrescriptions(auth.user.id, statusValue as PrescriptionStatus | undefined);
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
    return apiError(error, "Failed to retrieve pharmacy prescriptions.");
  }
}