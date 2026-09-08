import { UserRole } from "@prisma/client";
import { authorizeRequest } from "@/lib/permissions";
import { getPharmacyPrescriptionDetail } from "@/lib/pharmacy-service";
import { apiError, apiSuccess, errorFromResult } from "@/lib/api-errors";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await authorizeRequest({ allowedRoles: [UserRole.PHARMACY] });
    if (auth.errorResponse) return auth.errorResponse;

    const result = await getPharmacyPrescriptionDetail(auth.user.id, params.id);
    if ("error" in result) {
      return apiError(errorFromResult(result));
    }
    return apiSuccess(result);
  } catch (error) {
    console.error("Error fetching pharmacy prescription detail:", error);
    return apiError(error, "Failed to retrieve pharmacy prescription details.");
  }
}