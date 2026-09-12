import { UserRole, PrescriptionStatus } from "@prisma/client";
import { prisma } from "../lib/prisma";
import {
  AuthUser,
  requireRole,
  requireAuth,
  canUserAccessPrescription,
  AuthorizationError,
} from "../lib/permissions";
import { createDoctorPrescription } from "../lib/doctor-service";
import {
  storageService,
  validateDocumentFile,
  generateDocumentStorageKey,
  MAX_PRESCRIPTION_FILE_SIZE,
  ALLOWED_PRESCRIPTION_MIME_TYPES,
  ALLOWED_PRESCRIPTION_EXTENSIONS,
} from "../lib/storage";
import { GET as getPrescriptionDocumentHandler } from "../app/api/prescriptions/[id]/document/route";
import { POST as uploadPrescriptionDocumentHandler } from "../app/api/doctor/prescriptions/upload/route";

async function runDay19TestSuite() {
  console.log("===============================================================================");
  console.log("☁️  MedEasy Day 19 - Google Cloud Storage Integration & Security Verification");
  console.log("===============================================================================\n");

  let totalChecks = 0;
  let passedChecks = 0;

  function assert(condition: unknown, message: string) {
    totalChecks++;
    if (!condition) {
      console.error(`  ❌ FAIL: ${message}`);
      throw new Error(`Assertion failed: ${message}`);
    } else {
      passedChecks++;
      console.log(`  ✓ PASS: ${message}`);
    }
  }

  // 0. Load test accounts
  const [adminUser, doctorSarah, doctorJohn, pharmacyUser, patientAlice, patientRobert] =
    await Promise.all([
      prisma.user.findUniqueOrThrow({
        where: { email: "admin@medeasy.demo" },
      }),
      prisma.user.findUniqueOrThrow({
        where: { email: "dr.sarah@medeasy.demo" },
        include: { doctorProfile: true },
      }),
      prisma.user.findUniqueOrThrow({
        where: { email: "dr.john@medeasy.demo" },
        include: { doctorProfile: true },
      }),
      prisma.user.findUniqueOrThrow({
        where: { email: "pharmacy@medeasy.demo" },
        include: { pharmacyProfile: true },
      }),
      prisma.user.findUniqueOrThrow({
        where: { email: "patient.alice@medeasy.demo" },
        include: { patientProfile: true },
      }),
      prisma.user.findUniqueOrThrow({
        where: { email: "patient.robert@medeasy.demo" },
        include: { patientProfile: true },
      }),
    ]);

  const adminAuth: AuthUser = { id: adminUser.id, email: adminUser.email, role: UserRole.ADMIN };
  const doctorSarahAuth: AuthUser = { id: doctorSarah.id, email: doctorSarah.email, role: UserRole.DOCTOR };
  const doctorJohnAuth: AuthUser = { id: doctorJohn.id, email: doctorJohn.email, role: UserRole.DOCTOR };
  const pharmacyAuth: AuthUser = { id: pharmacyUser.id, email: pharmacyUser.email, role: UserRole.PHARMACY };
  const patientAliceAuth: AuthUser = { id: patientAlice.id, email: patientAlice.email, role: UserRole.PATIENT };
  const patientRobertAuth: AuthUser = { id: patientRobert.id, email: patientRobert.email, role: UserRole.PATIENT };

  const sampleMedicine = await prisma.medicine.findFirstOrThrow({ where: { stockStatus: true } });

  // ---------------------------------------------------------------------------
  // 1. FILE VALIDATION CONSTRAINTS (lib/storage.ts)
  // ---------------------------------------------------------------------------
  console.log("-------------------------------------------------------------------------------");
  console.log("1. VERIFY FILE VALIDATION CONSTRAINTS (lib/storage.ts)");
  console.log("-------------------------------------------------------------------------------");

  // 1a. Missing file
  const missingCheck = validateDocumentFile(null);
  assert(!missingCheck.valid && missingCheck.error === "File is required.", "Rejects missing file");

  // 1b. Empty file
  const emptyCheck = validateDocumentFile({
    buffer: Buffer.from([]),
    size: 0,
    originalName: "empty.pdf",
    mimeType: "application/pdf",
  });
  assert(!emptyCheck.valid && emptyCheck.error === "File cannot be empty.", "Rejects empty file");

  // 1c. Oversized file (> 5MB)
  const oversizedBuffer = Buffer.alloc(MAX_PRESCRIPTION_FILE_SIZE + 1024);
  const oversizedCheck = validateDocumentFile({
    buffer: oversizedBuffer,
    size: oversizedBuffer.length,
    originalName: "oversized.pdf",
    mimeType: "application/pdf",
  });
  assert(Boolean(!oversizedCheck.valid && oversizedCheck.error?.includes("exceeds the allowed limit")), "Rejects file exceeding 5MB");

  // 1d. Invalid MIME type
  const invalidMimeCheck = validateDocumentFile({
    buffer: Buffer.from("malicious content"),
    size: 17,
    originalName: "script.exe",
    mimeType: "application/x-msdownload",
  });
  assert(Boolean(!invalidMimeCheck.valid && invalidMimeCheck.error?.includes("Invalid file type")), "Rejects disallowed MIME type (.exe)");

  // 1e. Invalid extension
  const invalidExtCheck = validateDocumentFile({
    buffer: Buffer.from("fake text"),
    size: 9,
    originalName: "malware.bat",
    mimeType: "application/pdf",
  });
  assert(Boolean(!invalidExtCheck.valid && invalidExtCheck.error?.includes("Invalid file extension")), "Rejects disallowed file extension (.bat)");

  // 1f. Path traversal in originalName
  for (const traversalName of ["../../etc/passwd.pdf", "../root.pdf", "sub/evil.pdf", "foo\\bar.pdf", "doc\0.pdf"]) {
    const traversalCheck = validateDocumentFile({
      buffer: Buffer.from("dummy pdf"),
      size: 9,
      originalName: traversalName,
      mimeType: "application/pdf",
    });
    assert(Boolean(!traversalCheck.valid && traversalCheck.error?.includes("Path traversal")), `Rejects traversal in originalName: '${traversalName}'`);
  }

  // 1g. Valid files for all allowed formats
  for (const mime of ALLOWED_PRESCRIPTION_MIME_TYPES) {
    const ext = mime.includes("pdf") ? ".pdf" : mime.includes("png") ? ".png" : mime.includes("webp") ? ".webp" : ".jpg";
    const validCheck = validateDocumentFile({
      buffer: Buffer.from("valid binary content"),
      size: 20,
      originalName: `test-scan${ext}`,
      mimeType: mime,
    });
    assert(validCheck.valid, `Accepts valid format: ${mime} (${ext})`);
  }

  // ---------------------------------------------------------------------------
  // 2. OBJECT NAMING: UNIQUE, SCOPED, UNPREDICTABLE
  // ---------------------------------------------------------------------------
  console.log("\n-------------------------------------------------------------------------------");
  console.log("2. VERIFY OBJECT NAMING (UNIQUE, SCOPED, HIGH ENTROPY, NON-PREDICTABLE)");
  console.log("-------------------------------------------------------------------------------");

  const key1 = generateDocumentStorageKey("prescription.pdf");
  const key2 = generateDocumentStorageKey("prescription.pdf");

  assert(key1 !== key2, "Multiple calls generate distinct, non-colliding storage keys");
  assert(key1.startsWith("rx-docs/"), "Key uses scoped namespace prefix 'rx-docs/'");
  assert(!key1.includes("..") && !key1.includes("\\") && !key1.includes("\0"), "Key is sanitized against path traversal");
  assert(key1.endsWith(".pdf"), "Key preserves extension .pdf");
  assert(key1 !== "prescription.pdf" && key1 !== "rx-docs/prescription.pdf", "Avoids predictable generic name 'prescription.pdf'");

  // Check UUID presence in key
  const uuidPattern = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
  assert(uuidPattern.test(key1), "Key embeds secure UUID v4 for high entropy and unpredictability");

  // ---------------------------------------------------------------------------
  // 3. STORAGE ABSTRACTION & CRUD OPERATIONS
  // ---------------------------------------------------------------------------
  console.log("\n-------------------------------------------------------------------------------");
  console.log("3. VERIFY STORAGE ABSTRACTION & CRUD OPERATIONS");
  console.log("-------------------------------------------------------------------------------");

  const testFileBuffer = Buffer.from("%PDF-1.4 Day 19 Clinical Document Test Buffer Data");
  const uploadRes = await storageService.uploadPrescriptionDocument({
    buffer: testFileBuffer,
    originalName: "clinical-patient-chart.pdf",
    mimeType: "application/pdf",
    size: testFileBuffer.length,
  });

  assert(Boolean(uploadRes.documentRef), `Upload succeeded with documentRef: ${uploadRes.documentRef}`);
  assert(uploadRes.fileName === "clinical-patient-chart.pdf", "Upload result contains matching fileName");
  assert(uploadRes.mimeType === "application/pdf", "Upload result contains matching MIME type");
  assert(uploadRes.size === testFileBuffer.length, "Upload result contains matching size");

  // Check object exists
  const existsBefore = await storageService.checkObjectExists(uploadRes.documentRef);
  assert(existsBefore, "Uploaded document verified to exist in storage");

  // Retrieve document
  const retrievedDoc = await storageService.getDocument(uploadRes.documentRef);
  assert(Boolean(retrievedDoc && retrievedDoc.buffer), "getDocument retrieves document binary");
  assert(retrievedDoc!.buffer.toString() === testFileBuffer.toString(), "Retrieved buffer matches uploaded content exactly");
  assert(retrievedDoc!.mimeType === "application/pdf", "Retrieved document contains correct MIME type");

  // Non-existent key returns null
  const missingDoc = await storageService.getDocument("rx-docs/non-existent-file-99999.pdf");
  assert(missingDoc === null, "Missing object key returns null safely");

  // Path traversal in getDocument safely returns null
  const traversalDoc = await storageService.getDocument("../../../etc/shadow");
  assert(traversalDoc === null, "Path traversal probe in getDocument safely returns null");

  // Delete document
  const deleted = await storageService.deleteDocument(uploadRes.documentRef);
  assert(deleted, "Document deleted successfully from storage");

  const existsAfter = await storageService.checkObjectExists(uploadRes.documentRef);
  assert(!existsAfter, "Document verified no longer exists in storage after deletion");

  // ---------------------------------------------------------------------------
  // 4. POSTGRESQL REFERENCE ONLY (NO BINARY STORED IN DATABASE)
  // ---------------------------------------------------------------------------
  console.log("\n-------------------------------------------------------------------------------");
  console.log("4. VERIFY POSTGRESQL STORES ONLY DOCUMENT REFERENCE (NO BINARY IN DB)");
  console.log("-------------------------------------------------------------------------------");

  // Re-upload a document for database association test
  const clinicalPdf = Buffer.from("%PDF-1.4 MedEasy Patient Encounter Documentation");
  const docUpload = await storageService.uploadPrescriptionDocument({
    buffer: clinicalPdf,
    originalName: "encounter-notes.pdf",
    mimeType: "application/pdf",
    size: clinicalPdf.length,
  });

  const createRxResult = await createDoctorPrescription(doctorSarah.id, {
    patientId: patientAlice.patientProfile!.id,
    diagnosis: "Day 19 GCS Verification - Acute Bronchitis",
    documentRef: docUpload.documentRef,
    medicines: [
      {
        medicineId: sampleMedicine.id,
        dosage: "500mg",
        frequency: "Twice daily",
        duration: "5 days",
      },
    ],
  });

  assert(!("error" in createRxResult), "Prescription created with documentRef in database");
  const createdRx = ("prescription" in createRxResult) ? createRxResult.prescription : null;
  assert(Boolean(createdRx?.id), `Prescription created with ID: ${createdRx?.id}`);

  // Query raw database row to inspect stored columns
  const rawDbRx = await prisma.prescription.findUniqueOrThrow({
    where: { id: createdRx!.id },
  });

  assert(rawDbRx.documentRef === docUpload.documentRef, "PostgreSQL stores exact documentRef string reference");
  assert(typeof rawDbRx.documentRef === "string", "documentRef is a string identifier");

  // Verify no binary fields on Prescription model
  const dbKeys = Object.keys(rawDbRx);
  const binaryKeys = dbKeys.filter(k => k.toLowerCase().includes("blob") || k.toLowerCase().includes("binary") || k.toLowerCase().includes("buffer") || k.toLowerCase().includes("byte"));
  assert(binaryKeys.length === 0, "Zero binary/blob columns in PostgreSQL Prescription table");

  // ---------------------------------------------------------------------------
  // 5. ACCESS CONTROL MATRIX VIA GET /api/prescriptions/[id]/document
  // ---------------------------------------------------------------------------
  console.log("\n-------------------------------------------------------------------------------");
  console.log("5. VERIFY ACCESS CONTROL MATRIX VIA canUserAccessPrescription");
  console.log("-------------------------------------------------------------------------------");

  // 5a. Author Doctor -> Allowed (200)
  const authorCheck = await canUserAccessPrescription(doctorSarahAuth, createdRx!.id);
  assert(authorCheck.allowed, "Authorized Doctor (author) granted access to prescription document");

  // 5b. Unauthorized Doctor (Dr. John) -> Forbidden (403)
  const wrongDoctorCheck = await canUserAccessPrescription(doctorJohnAuth, createdRx!.id);
  assert(!wrongDoctorCheck.allowed, "Unauthorized Doctor (non-author) blocked from prescription document");

  // 5c. Owner Patient (Alice) -> Allowed (200)
  const ownerPatientCheck = await canUserAccessPrescription(patientAliceAuth, createdRx!.id);
  assert(ownerPatientCheck.allowed, "Authorized Patient (recipient) granted access to own prescription document");

  // 5d. Unauthorized Patient (Robert) -> Forbidden (403)
  const strangerPatientCheck = await canUserAccessPrescription(patientRobertAuth, createdRx!.id);
  assert(!strangerPatientCheck.allowed, "Unauthorized Patient (stranger) blocked from another patient's document");

  // 5e. Pharmacy User -> Allowed (200)
  const pharmacyCheck = await canUserAccessPrescription(pharmacyAuth, createdRx!.id);
  assert(pharmacyCheck.allowed, "Authorized Pharmacy granted access to prescription document for fulfillment");

  // 5f. Admin User -> Allowed (200)
  const adminCheck = await canUserAccessPrescription(adminAuth, createdRx!.id);
  assert(adminCheck.allowed, "Authorized Admin granted access to prescription document for auditing");

  // ---------------------------------------------------------------------------
  // 6. ROUTE LEVEL ACCESS CONTROL & SECURITY HEADERS
  // ---------------------------------------------------------------------------
  console.log("\n-------------------------------------------------------------------------------");
  console.log("6. VERIFY ROUTE LEVEL ACCESS CONTROL & SECURITY HEADERS");
  console.log("-------------------------------------------------------------------------------");

  // 6a. Unauthenticated request to GET /api/prescriptions/[id]/document -> 401
  const unauthReq = new Request(`http://localhost:3000/api/prescriptions/${createdRx!.id}/document`);
  const unauthDocRes = await getPrescriptionDocumentHandler(unauthReq, { params: { id: createdRx!.id } });
  assert(unauthDocRes.status === 401, "GET /api/prescriptions/[id]/document returns 401 when unauthenticated");

  // 6b. Non-existent prescription ID -> 401 or 404 (when unauth -> 401)
  const notFoundReq = new Request("http://localhost:3000/api/prescriptions/non-existent-id/document");
  const notFoundDocRes = await getPrescriptionDocumentHandler(notFoundReq, { params: { id: "non-existent-id" } });
  assert(notFoundDocRes.status === 401 || notFoundDocRes.status === 404, "Invalid prescription returns appropriate error status");

  // 6c. Unauthenticated upload to POST /api/doctor/prescriptions/upload -> 401
  const unauthUploadReq = new Request("http://localhost:3000/api/doctor/prescriptions/upload", { method: "POST" });
  const unauthUploadRes = await uploadPrescriptionDocumentHandler(unauthUploadReq);
  assert(unauthUploadRes.status === 401, "POST /api/doctor/prescriptions/upload returns 401 when unauthenticated");

  // 6d. Role enforcement: Non-doctor cannot upload
  for (const role of [UserRole.PATIENT, UserRole.PHARMACY, UserRole.ADMIN]) {
    let roleRejected = false;
    try {
      await requireRole(UserRole.DOCTOR, { id: "some-user-id", email: "user@test.demo", role });
    } catch (err) {
      if (err instanceof AuthorizationError && err.statusCode === 403) {
        roleRejected = true;
      }
    }
    assert(roleRejected, `Role ${role} strictly blocked from Doctor upload endpoint with 403 Forbidden`);
  }

  // ---------------------------------------------------------------------------
  // 7. SECURITY SANITIZATION & PRIVACY GUARANTEES
  // ---------------------------------------------------------------------------
  console.log("\n-------------------------------------------------------------------------------");
  console.log("7. VERIFY SECURITY SANITIZATION & ZERO SENSITIVE LEAKS");
  console.log("-------------------------------------------------------------------------------");

  const docUrl = await storageService.getDocumentUrl(docUpload.documentRef);
  assert(Boolean(docUrl && !docUrl.startsWith("https://storage.googleapis.com")), "Storage does not expose direct public storage.googleapis.com links");
  assert(Boolean(docUrl?.startsWith("/api/doctor/prescriptions/documents/")), "Storage resolves through authenticated internal route");

  const forbiddenStrings = [
    "password",
    "passwordHash",
    "GCP_PRIVATE_KEY",
    "private_key",
    "client_email",
    "NEXTAUTH_SECRET",
  ];

  const uploadResultString = JSON.stringify(docUpload);
  for (const forbidden of forbiddenStrings) {
    assert(!uploadResultString.includes(`"${forbidden}"`), `Upload response does not expose sensitive secret '${forbidden}'`);
  }

  // Clean up test data
  await prisma.prescriptionMedicine.deleteMany({ where: { prescriptionId: createdRx!.id } });
  await prisma.prescription.delete({ where: { id: createdRx!.id } });
  await storageService.deleteDocument(docUpload.documentRef);
  console.log(`  ✓ Cleaned up test prescription [ID: ${createdRx!.id}] and storage object`);

  // ---------------------------------------------------------------------------
  // SUMMARY
  // ---------------------------------------------------------------------------
  console.log("\n===============================================================================");
  console.log(`🎉 ALL ${passedChecks}/${totalChecks} DAY 19 GCS STORAGE & SECURITY AUDIT CHECKS PASSED!`);
  console.log("===============================================================================\n");
}

runDay19TestSuite()
  .catch((err) => {
    console.error("\n❌ Day 19 Test Suite Failed:\n", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
