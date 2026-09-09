import { UserRole } from "@prisma/client";
import { AuthUser, authorizeRequest } from "@/lib/permissions";
import { fulfillPrescription } from "@/lib/pharmacy-service";
import { apiError, apiSuccess } from "@/lib/api-response";
import { AppError, AppErrorCode, ValidationError } from "@/lib/errors";
import { validateJsonBody } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
  options?: { userOverride?: AuthUser | null }
) {
  try {
    const auth = await authorizeRequest({
      allowedRoles: [UserRole.PHARMACY],
      ...(options?.userOverride !== undefined ? { userOverride: options.userOverride } : {}),
    });
    if (auth.errorResponse) return auth.errorResponse;

    if (!params?.id) {
      throw new ValidationError("Prescription ID is required.");
    }

    const body = await validateJsonBody<Record<string, unknown>>(request);
    const { action, notes } = body;

    const result = await fulfillPrescription(auth.user.id, params.id, {
      action: typeof action === "string" ? action : "",
      notes: typeof notes === "string" ? notes : null,
    });

    if ("error" in result) {
      const code =
        result.statusCode === 404
          ? AppErrorCode.NOT_FOUND
          : result.statusCode === 409
          ? AppErrorCode.CONFLICT
          : result.statusCode === 400
          ? AppErrorCode.VALIDATION_ERROR
          : AppErrorCode.BUSINESS_RULE_ERROR;
      return apiError(new AppError(code, result.error || "Prescription fulfillment failed.", result.statusCode));
    }

    return apiSuccess(result, 200);
  } catch (error) {
    return apiError(error, "Failed to fulfill prescription.");
  }
}
