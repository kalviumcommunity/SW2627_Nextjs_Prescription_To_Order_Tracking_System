import { authorizeRequest, canUserAccessPrescription } from "@/lib/permissions";
import { apiError, apiSuccess } from "@/lib/api-response";
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";

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

    if (!prescriptionId) {
      throw new ValidationError("Prescription ID is required.");
    }

    // 2. Enforce granular resource ownership & access permissions
    const accessCheck = await canUserAccessPrescription(user, prescriptionId);

    if (!accessCheck.allowed) {
      if (accessCheck.reason === "Prescription not found.") {
        throw new NotFoundError("Prescription not found.");
      }

      throw new ForbiddenError(
        accessCheck.reason || "Forbidden. Access to this prescription is denied."
      );
    }

    return apiSuccess({ prescription: accessCheck.prescription }, 200);
  } catch (error) {
    return apiError(error, "Failed to retrieve prescription.");
  }
}
