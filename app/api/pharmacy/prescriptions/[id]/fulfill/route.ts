import { UserRole } from "@prisma/client";
import { AuthUser, authorizeRequest } from "@/lib/permissions";
import { fulfillPrescription } from "@/lib/pharmacy-service";
import { apiError, apiSuccess, errorFromResult, validationError } from "@/lib/api-errors";

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

    if (!params?.id || typeof params.id !== "string" || !params.id.trim()) {
      return apiError(validationError("Prescription ID is required."));
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return apiError(validationError("Invalid request payload. Expected JSON object with action."));
    }

    // Whitelist only action and notes fields.
    // Client-supplied pharmacyId or status overrides are discarded.
    const { action, notes } = body as { action?: unknown; notes?: unknown };
    const result = await fulfillPrescription(auth.user.id, params.id.trim(), {
      action: typeof action === "string" ? action.trim() : "",
      notes: typeof notes === "string" ? notes.trim() || null : null,
    });

    if ("error" in result) {
      return apiError(errorFromResult(result));
    }

    return apiSuccess(result);
  } catch (error) {
    console.error("Error fulfilling pharmacy prescription:", error);
    return apiError(error, "Failed to fulfill prescription.");
  }
}
