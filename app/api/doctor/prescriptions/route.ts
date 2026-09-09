import { UserRole } from "@prisma/client";
import { authorizeRequest } from "@/lib/permissions";
import {
  createDoctorPrescription,
  getDoctorPrescriptionsList,
  CreatePrescriptionMedicineInput,
} from "@/lib/doctor-service";
import { apiError, apiSuccess } from "@/lib/api-response";
import { AppError, AppErrorCode } from "@/lib/errors";
import { validateJsonBody } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const auth = await authorizeRequest({ allowedRoles: [UserRole.DOCTOR] });
    if (auth.errorResponse) {
      return auth.errorResponse;
    }

    const result = await getDoctorPrescriptionsList(auth.user.id);
    if ("error" in result && result.error) {
      return apiError(
        new AppError(
          result.statusCode === 404 ? AppErrorCode.NOT_FOUND : AppErrorCode.BUSINESS_RULE_ERROR,
          result.error,
          result.statusCode
        )
      );
    }

    return apiSuccess({
      doctor: result.doctor,
      prescriptions: result.prescriptions,
    });
  } catch (error) {
    return apiError(error, "Failed to retrieve prescriptions.");
  }
}

export async function POST(req: Request) {
  try {
    const auth = await authorizeRequest({ allowedRoles: [UserRole.DOCTOR] });
    if (auth.errorResponse) {
      return auth.errorResponse;
    }

    const body = await validateJsonBody<Record<string, unknown>>(req);

    const result = await createDoctorPrescription(auth.user.id, {
      patientId: typeof body.patientId === "string" ? body.patientId : "",
      diagnosis: typeof body.diagnosis === "string" ? body.diagnosis : "",
      documentRef: typeof body.documentRef === "string" ? body.documentRef : null,
      medicines: Array.isArray(body.medicines)
        ? (body.medicines as CreatePrescriptionMedicineInput[])
        : [],
    });

    if ("error" in result && result.error) {
      const code =
        result.statusCode === 404
          ? AppErrorCode.NOT_FOUND
          : result.statusCode === 403
          ? AppErrorCode.FORBIDDEN
          : result.statusCode === 400
          ? AppErrorCode.VALIDATION_ERROR
          : AppErrorCode.BUSINESS_RULE_ERROR;
      return apiError(new AppError(code, result.error, result.statusCode));
    }

    return apiSuccess({ prescription: result.prescription }, 201);
  } catch (error) {
    return apiError(error, "Failed to create prescription.");
  }
}
