import { UserRole } from "@prisma/client";
import { authorizeRequest } from "@/lib/permissions";
import { getDoctorPrescriptionDetail } from "@/lib/doctor-service";
import { apiError, apiSuccess, errorFromResult, validationError } from "@/lib/api-errors";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await authorizeRequest({ allowedRoles: [UserRole.DOCTOR] });
    if (auth.errorResponse) {
      return auth.errorResponse;
    }

    if (!params?.id || typeof params.id !== "string" || !params.id.trim()) {
      return apiError(validationError("Prescription ID is required."));
    }

    const result = await getDoctorPrescriptionDetail(auth.user.id, params.id.trim());
    if ("error" in result && result.error) {
      return apiError(errorFromResult(result));
    }

    return apiSuccess({ prescription: result.prescription });
  } catch (error) {
    return apiError(error, "Failed to retrieve prescription details.");
  }
}
