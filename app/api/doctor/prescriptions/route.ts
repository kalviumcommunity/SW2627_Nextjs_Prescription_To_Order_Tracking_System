import { PrescriptionStatus, UserRole } from "@prisma/client";
import { authorizeRequest } from "@/lib/permissions";
import { createDoctorPrescription, getDoctorPrescriptionsList } from "@/lib/doctor-service";
import { apiError, apiSuccess, errorFromResult, validationError } from "@/lib/api-errors";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const auth = await authorizeRequest({ allowedRoles: [UserRole.DOCTOR] });
    if (auth.errorResponse) {
      return auth.errorResponse;
    }

    let statusParam: string | null = null;
    if (request) {
      const { searchParams } = new URL(request.url);
      statusParam = searchParams.get("status");
    }

    if (
      statusParam &&
      !Object.values(PrescriptionStatus).includes(statusParam as PrescriptionStatus)
    ) {
      return apiError(
        validationError(
          "Invalid prescription status filter. Allowed values: PENDING, FILLED, CANNOT_FILL."
        )
      );
    }

    const result = await getDoctorPrescriptionsList(
      auth.user.id,
      statusParam ? { status: statusParam as PrescriptionStatus } : undefined
    );

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
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return apiError(validationError("Invalid request payload. Expected JSON object."));
    }

    // Whitelist only approved input fields, preventing mass assignment of status or doctorId
    const result = await createDoctorPrescription(auth.user.id, {
      patientId: typeof body.patientId === "string" ? body.patientId.trim() : "",
      diagnosis: typeof body.diagnosis === "string" ? body.diagnosis.trim() : "",
      documentRef: typeof body.documentRef === "string" ? body.documentRef.trim() : null,
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
