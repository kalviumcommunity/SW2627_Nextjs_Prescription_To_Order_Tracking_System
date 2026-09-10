import { authorizeRequest, canUserAccessPrescription } from "@/lib/permissions";
import { apiError, apiSuccess, forbiddenError, notFoundError, validationError } from "@/lib/api-errors";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    // 1. Enforce authentication
    const auth = await authorizeRequest();
    if (auth.errorResponse) {
      return auth.errorResponse;
    }

    const { user } = auth;
    const prescriptionId = params?.id;

    if (!prescriptionId || typeof prescriptionId !== "string" || !prescriptionId.trim()) {
      return apiError(validationError("Prescription ID is required."));
    }

    // 2. Enforce granular resource ownership & access permissions
    const accessCheck = await canUserAccessPrescription(user, prescriptionId.trim());

    if (!accessCheck.allowed) {
      if (accessCheck.reason === "Prescription not found.") {
        return apiError(notFoundError("Prescription not found."));
      }

      return apiError(forbiddenError(accessCheck.reason || "Forbidden. Access to this prescription is denied."));
    }

    return apiSuccess({ prescription: accessCheck.prescription });
  } catch (error) {
    return apiError(error, "Failed to retrieve prescription.");
  }
}
