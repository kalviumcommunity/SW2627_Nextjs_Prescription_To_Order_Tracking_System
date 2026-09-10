import { NextResponse } from "next/server";
import { authorizeRequest, canUserAccessPrescription } from "@/lib/permissions";
import { storageService } from "@/lib/storage";
import { apiError, forbiddenError, notFoundError, validationError } from "@/lib/api-errors";

export const dynamic = "force-dynamic";

/**
 * GET /api/prescriptions/[id]/document
 * Protected endpoint for downloading/viewing a prescription attachment.
 * 
 * SECURITY RULES:
 * 1. Requires authenticated session (401 if unauthenticated).
 * 2. Enforces resource ownership via canUserAccessPrescription (403 if unauthorized).
 * 3. Access is strictly mediated through the verified Prescription ID in PostgreSQL,
 *    preventing Insecure Direct Object Reference (IDOR) by guessing document reference IDs.
 * 4. Never exposes storage credentials or internal storage bucket paths.
 */
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

    // 2. Enforce prescription access permissions (Doctor author, Patient recipient, Pharmacy, or Admin)
    const accessCheck = await canUserAccessPrescription(user, prescriptionId.trim());
    if (!accessCheck.allowed) {
      if (accessCheck.reason === "Prescription not found.") {
        return apiError(notFoundError("Prescription not found."));
      }

      return apiError(
        forbiddenError(accessCheck.reason || "Forbidden. Access to this prescription document is denied.")
      );
    }

    const prescription = accessCheck.prescription as { documentRef?: string | null } | undefined;
    const documentRef = prescription?.documentRef;

    if (!documentRef || typeof documentRef !== "string" || !documentRef.trim()) {
      return apiError(notFoundError("Prescription does not have an attached document."));
    }

    // 3. Retrieve document binary content safely through storage abstraction
    const doc = await storageService.getDocument(documentRef.trim());
    if (!doc || !doc.buffer) {
      return apiError(notFoundError("Document file not found in storage."));
    }

    // 4. Return document stream with security headers
    return new NextResponse(new Uint8Array(doc.buffer), {
      status: 200,
      headers: {
        "Content-Type": doc.mimeType || "application/octet-stream",
        "Content-Disposition": `inline; filename="${encodeURIComponent(doc.fileName)}"`,
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, no-cache, no-store, must-revalidate",
      },
    });
  } catch (error) {
    return apiError(error, "Failed to retrieve prescription document.");
  }
}
