import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { authorizeRequest } from "@/lib/permissions";
import {
  storageService,
  validateDocumentFile,
  ALLOWED_PRESCRIPTION_MIME_TYPES,
  ALLOWED_PRESCRIPTION_EXTENSIONS,
  MAX_PRESCRIPTION_FILE_SIZE,
} from "@/lib/storage";

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
      return NextResponse.json(
        { error: "Invalid multipart form data in request body." },
        { status: 400 }
      );
    }

    const file = formData.get("file") || formData.get("document");

    if (!file || typeof file === "string" || !(file instanceof Blob)) {
      return NextResponse.json(
        { error: "File is required. Please attach a valid document file." },
        { status: 400 }
      );
    }

    // 3. Extract File Properties
    const originalName = (file as any).name || "prescription-document.pdf";
    const mimeType = file.type || "application/octet-stream";
    const size = file.size;

    // 4. File Size & Type Validation
    if (size === 0) {
      return NextResponse.json(
        { error: "File cannot be empty." },
        { status: 400 }
      );
    }

    if (size > MAX_PRESCRIPTION_FILE_SIZE) {
      return NextResponse.json(
        {
          error: `File size exceeds the allowed limit of ${Math.round(
            MAX_PRESCRIPTION_FILE_SIZE / (1024 * 1024)
          )}MB.`,
        },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    const validation = validateDocumentFile({
      buffer,
      originalName,
      mimeType,
      size,
    });

    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error || "File validation failed." },
        { status: 400 }
      );
    }

    // 5. Upload to Cloud Storage Abstraction Layer
    const uploadResult = await storageService.uploadPrescriptionDocument({
      buffer,
      originalName,
      mimeType,
      size,
    });

    return NextResponse.json(
      {
        success: true,
        documentRef: uploadResult.documentRef,
        fileName: uploadResult.fileName,
        size: uploadResult.size,
        mimeType: uploadResult.mimeType,
        url: uploadResult.url,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Prescription document upload failed:", error);
    return NextResponse.json(
      { error: "Failed to upload prescription document to storage." },
      { status: 500 }
    );
  }
}
