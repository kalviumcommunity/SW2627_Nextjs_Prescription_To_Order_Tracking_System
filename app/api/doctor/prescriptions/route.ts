import { UserRole } from "@prisma/client";
import { authorizeRequest } from "@/lib/permissions";
import { createDoctorPrescription, getDoctorPrescriptionsList } from "@/lib/doctor-service";
import { apiError, apiSuccess, errorFromResult, validationError } from "@/lib/api-errors";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const auth = await authorizeRequest({ allowedRoles: [UserRole.DOCTOR] });
    if (auth.errorResponse) {
      return auth.errorResponse;
    }

    const result = await getDoctorPrescriptionsList(auth.user.id);
    if ("error" in result && result.error) {
      return apiError(errorFromResult(result));
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

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return apiError(validationError("Invalid request payload."));
    }

    const result = await createDoctorPrescription(auth.user.id, {
      patientId: body.patientId,
      diagnosis: body.diagnosis,
      documentRef: body.documentRef ?? null,
      medicines: Array.isArray(body.medicines) ? body.medicines : [],
    });

    if ("error" in result && result.error) {
      return apiError(errorFromResult(result));
    }

    return apiSuccess({ prescription: result.prescription }, 201);
  } catch (error) {
    return apiError(error, "Failed to create prescription.");
  }
}
