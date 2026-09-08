import { PrescriptionStatus, UserRole } from "@prisma/client";
import { authorizeRequest } from "@/lib/permissions";
import { getPharmacyPrescriptions } from "@/lib/pharmacy-service";
import { apiError, apiSuccess, errorFromResult, validationError } from "@/lib/api-errors";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const auth = await authorizeRequest({ allowedRoles: [UserRole.PHARMACY] });
    if (auth.errorResponse) return auth.errorResponse;

    const searchParams = new URL(request.url).searchParams;
    const hasStatus = searchParams.has("status");
    const statusValue = searchParams.get("status");
    if (hasStatus && (!statusValue || !Object.values(PrescriptionStatus).includes(statusValue as PrescriptionStatus))) {
      return apiError(validationError("Invalid status. Use PENDING, FILLED, or CANNOT_FILL."));
    }

    const result = await getPharmacyPrescriptions(auth.user.id, statusValue as PrescriptionStatus | undefined);
    if ("error" in result) {
      return apiError(errorFromResult(result));
    }
    return apiSuccess(result);
  } catch (error) {
    console.error("Error fetching pharmacy prescriptions:", error);
    return apiError(error, "Failed to retrieve pharmacy prescriptions.");
  }
}