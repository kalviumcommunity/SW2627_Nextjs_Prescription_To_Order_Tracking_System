import { UserRole } from "@prisma/client";
import { authorizeRequest } from "@/lib/permissions";
import {
  storageService,
  validateDocumentFile,
  ALLOWED_PRESCRIPTION_MIME_TYPES,
  ALLOWED_PRESCRIPTION_EXTENSIONS,
  MAX_PRESCRIPTION_FILE_SIZE,
} from "@/lib/storage";
import { apiError, apiSuccess } from "@/lib/api-response";
import { ValidationError } from "@/lib/errors";

export const dynamic = "force-dynamic";

/**
 * POST /api/doctor/prescriptions/upload
 * Protected endpoint allowing an authenticated clinician to securely upload
 * prescription attachments (PDF, PNG, JPEG) to cloud storage.
 * Returns a canonical documentRef to be stored in PostgreSQL.
 */
export async function POST(req: Request) {
  try {
    // 1. Role-based authorization guard (DOCTOR only)
    const auth = await authorizeRequest({ allowedRoles: [UserRole.DOCTOR] });
    if (auth.errorResponse) {
      return auth.errorResponse;
    }

    // 2. Parse Multipart Form Data
    let formData: FormData;
    try {
      formData = await req.formData();
    } catch {
      throw new ValidationError("Invalid multipart form data in request body.");
    }

    const file = formData.get("file") || formData.get("document");

    if (!file || typeof file === "string" || !(file instanceof Blob)) {
      throw new ValidationError("File is required. Please attach a valid document file.");
    }

    // 3. Extract File Properties
    const originalName = file.name || "prescription-document.pdf";
    const mimeType = file.type || "application/octet-stream";
    const size = file.size;

    // 4. File Size & Type Validation
    if (size === 0) {
      throw new ValidationError("File cannot be empty.");
    }

    if (size > MAX_PRESCRIPTION_FILE_SIZE) {
      throw new ValidationError(
        `File size exceeds the allowed limit of ${Math.round(
          MAX_PRESCRIPTION_FILE_SIZE / (1024 * 1024)
        )}MB.`
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    const validation = validateDocumentFile(
      {
        buffer,
        originalName,
        mimeType,
        size,
      },
      {
        allowedMimeTypes: ALLOWED_PRESCRIPTION_MIME_TYPES,
        allowedExtensions: ALLOWED_PRESCRIPTION_EXTENSIONS,
      }
    );

    if (!validation.valid) {
      throw new ValidationError(validation.error || "File validation failed.");
    }

    // 5. Upload to Cloud Storage Abstraction Layer
    const uploadResult = await storageService.uploadPrescriptionDocument({
      buffer,
      originalName,
      mimeType,
      size,
    });

    return apiSuccess(
      {
        success: true,
        documentRef: uploadResult.documentRef,
        fileName: uploadResult.fileName,
        size: uploadResult.size,
        mimeType: uploadResult.mimeType,
        url: uploadResult.url,
      },
      201
    );
  } catch (error) {
    return apiError(error, "Failed to upload prescription document to storage.");
  }
}
