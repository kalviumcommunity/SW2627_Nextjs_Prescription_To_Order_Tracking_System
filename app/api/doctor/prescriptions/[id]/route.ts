import { UserRole } from "@prisma/client";
import { authorizeRequest } from "@/lib/permissions";
import { getDoctorPrescriptionDetail } from "@/lib/doctor-service";
import { apiError, apiSuccess } from "@/lib/api-response";
import { AppError, AppErrorCode, ValidationError } from "@/lib/errors";

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

    if (!params?.id) {
      throw new ValidationError("Prescription ID is required.");
    }

    const result = await getDoctorPrescriptionDetail(auth.user.id, params.id);
    if ("error" in result && result.error) {
      const code =
        result.statusCode === 404
          ? AppErrorCode.NOT_FOUND
          : result.statusCode === 403
          ? AppErrorCode.FORBIDDEN
          : AppErrorCode.BUSINESS_RULE_ERROR;
      return apiError(new AppError(code, result.error, result.statusCode));
    }

    return apiSuccess({ prescription: result.prescription }, 200);
  } catch (error) {
    return apiError(error, "Failed to retrieve prescription details.");
  }
}
