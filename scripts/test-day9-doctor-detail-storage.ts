import { UserRole, PrescriptionStatus } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { AuthUser, requireRole, AuthorizationError } from "../lib/permissions";
import {
  getDoctorPrescriptionsList,
  getDoctorPrescriptionDetail,
  createDoctorPrescription,
} from "../lib/doctor-service";
import {
  storageService,
  validateDocumentFile,
  generateDocumentStorageKey,
  MAX_PRESCRIPTION_FILE_SIZE,
} from "../lib/storage";

async function runDay9TestSuite() {
  console.log("===============================================================================");
  console.log("🩺 MedEasy Day 9 PR #25 - Doctor Prescription Detail & Document Storage Tests");
  console.log("===============================================================================\n");

  let totalChecks = 0;
  let passedChecks = 0;

  function assert(condition: boolean, message: string) {
    totalChecks++;
    if (!condition) {
      console.error(`  ❌ FAIL: ${message}`);
      throw new Error(`Assertion failed: ${message}`);
    } else {
      passedChecks++;
      console.log(`  ✓ PASS: ${message}`);
    }
  }

  // 1. Retrieve seeded test accounts
  const [adminUserDb, doctorSarahDb, doctorJohnDb, pharmacyUserDb, patientAliceDb] =
    await Promise.all([
      prisma.user.findUniqueOrThrow({ where: { email: "admin@medeasy.demo" } }),
      prisma.user.findUniqueOrThrow({
        where: { email: "dr.sarah@medeasy.demo" },
        include: { doctorProfile: true },
      }),
      prisma.user.findUniqueOrThrow({
        where: { email: "dr.john@medeasy.demo" },
        include: { doctorProfile: true },
      }),
      prisma.user.findUniqueOrThrow({ where: { email: "pharmacy@medeasy.demo" } }),
      prisma.user.findUniqueOrThrow({
        where: { email: "patient.alice@medeasy.demo" },
        include: { patientProfile: true },
      }),
    ]);

  const doctorSarahProfileId = doctorSarahDb.doctorProfile!.id;
  const doctorJohnProfileId = doctorJohnDb.doctorProfile!.id;

  // ---------------------------------------------------------------------------
  // 1. DOCTOR DETAIL VIEW: AUTHORIZED ACCESS & PRD FIELD COMPLIANCE
  // ---------------------------------------------------------------------------
  console.log("-------------------------------------------------------------------------------");
  console.log("1. VERIFY AUTHORIZED DOCTOR PRESCRIPTION DETAIL & PRD FIELD RETRIEVAL");
  console.log("-------------------------------------------------------------------------------");

  // Fetch Dr. Sarah's prescriptions
  const sarahListResult = await getDoctorPrescriptionsList(doctorSarahDb.id);
  assert(!("error" in sarahListResult), "Dr. Sarah prescription list retrieved successfully");

  if (!("error" in sarahListResult)) {
    assert(sarahListResult.prescriptions.length > 0, "Dr. Sarah has active prescriptions");
    const targetRx = sarahListResult.prescriptions[0];

    const detailResult = await getDoctorPrescriptionDetail(doctorSarahDb.id, targetRx.id);
    assert(!("error" in detailResult), "Author doctor granted access to prescription detail");

    if (!("error" in detailResult)) {
      const rx = detailResult.prescription;

      // PRD Requirement: Prescription ID
      assert(Boolean(rx.id), `Prescription ID present: ${rx.id}`);

      // PRD Requirement: Patient information (name, age, gender)
      assert(Boolean(rx.patient), "Patient information present");
      assert(typeof rx.patient.name === "string" && rx.patient.name.length > 0, `Patient name: ${rx.patient.name}`);
      assert(typeof rx.patient.age === "number", `Patient age: ${rx.patient.age}`);
      assert(typeof rx.patient.gender === "string", `Patient gender: ${rx.patient.gender}`);

      // PRD Requirement: Doctor information (name, specialization)
      assert(Boolean(rx.doctor), "Doctor information present");
      assert(typeof rx.doctor?.name === "string" && rx.doctor.name.startsWith("Dr."), `Doctor display name: ${rx.doctor?.name}`);
      assert(typeof rx.doctor?.specialization === "string", `Doctor specialization: ${rx.doctor?.specialization}`);

      // PRD Requirement: Clinical Diagnosis
      assert(typeof rx.diagnosis === "string" && rx.diagnosis.length > 0, `Clinical diagnosis: "${rx.diagnosis}"`);

      // PRD Requirement: Itemized Medicines (name, dosage, frequency, duration)
      assert(Array.isArray(rx.prescriptionMedicines) && rx.prescriptionMedicines.length > 0, "Prescription medicines array populated");
      for (const medItem of rx.prescriptionMedicines) {
        assert(Boolean(medItem.medicine?.name), `Medicine name: ${medItem.medicine.name}`);
        assert(Boolean(medItem.dosage), `Dosage: ${medItem.dosage}`);
        assert(Boolean(medItem.frequency), `Frequency: ${medItem.frequency}`);
        assert(Boolean(medItem.duration), `Duration: ${medItem.duration}`);
      }

      // PRD Requirement: Document Reference
      assert(rx.documentRef !== undefined, `Prescription documentRef field present: ${rx.documentRef}`);

      // PRD Requirement: Status (PENDING, FILLED, CANNOT_FILL)
      assert(
        [PrescriptionStatus.PENDING, PrescriptionStatus.FILLED, PrescriptionStatus.CANNOT_FILL].includes(rx.status),
        `Prescription status valid: ${rx.status}`
      );

      // PRD Requirement: Created timestamp
      assert(Boolean(rx.createdAt), `Created timestamp present: ${rx.createdAt}`);

      // PRD Requirement: Fulfillment timestamp when available
      if (rx.status === PrescriptionStatus.FILLED) {
        assert(Boolean(rx.filledAt || rx.fill?.filledAt), "Filled prescription includes fulfillment timestamp");
      }
    }
  }

  // ---------------------------------------------------------------------------
  // 2. UNAUTHORIZED OWNERSHIP ACCESS (CROSS-DOCTOR ISOLATION -> HTTP 403)
  // ---------------------------------------------------------------------------
  console.log("\n-------------------------------------------------------------------------------");
  console.log("2. VERIFY UNAUTHORIZED OWNERSHIP ACCESS REJECTION (HTTP 403 FORBIDDEN)");
  console.log("-------------------------------------------------------------------------------");

  const johnListResult = await getDoctorPrescriptionsList(doctorJohnDb.id);
  assert(!("error" in johnListResult), "Dr. John prescription list retrieved successfully");

  if (!("error" in johnListResult) && !("error" in sarahListResult)) {
    const sarahRxId = sarahListResult.prescriptions[0].id;
    const johnRxId = johnListResult.prescriptions[0].id;

    // Dr. John attempts to access Dr. Sarah's prescription
    const unauthorizedAttempt1 = await getDoctorPrescriptionDetail(doctorJohnDb.id, sarahRxId);
    assert("error" in unauthorizedAttempt1, "Dr. John blocked from Dr. Sarah's prescription");
    if ("error" in unauthorizedAttempt1) {
      assert(unauthorizedAttempt1.statusCode === 403, "Cross-doctor access returns HTTP 403 Forbidden");
    }

    // Dr. Sarah attempts to access Dr. John's prescription
    const unauthorizedAttempt2 = await getDoctorPrescriptionDetail(doctorSarahDb.id, johnRxId);
    assert("error" in unauthorizedAttempt2, "Dr. Sarah blocked from Dr. John's prescription");
    if ("error" in unauthorizedAttempt2) {
      assert(unauthorizedAttempt2.statusCode === 403, "Cross-doctor access returns HTTP 403 Forbidden");
    }
  }

  // ---------------------------------------------------------------------------
  // 3. MISSING PRESCRIPTION HANDLING (HTTP 404 NOT FOUND)
  // ---------------------------------------------------------------------------
  console.log("\n-------------------------------------------------------------------------------");
  console.log("3. VERIFY NON-EXISTENT PRESCRIPTION HANDLING (HTTP 404 NOT FOUND)");
  console.log("-------------------------------------------------------------------------------");

  const nonExistentResult = await getDoctorPrescriptionDetail(doctorSarahDb.id, "nonexistent-id-99999");
  assert("error" in nonExistentResult, "Non-existent prescription returns error");
  if ("error" in nonExistentResult) {
    assert(nonExistentResult.statusCode === 404, "Missing prescription returns HTTP 404 Not Found");
  }

  // ---------------------------------------------------------------------------
  // 4. ROUTE HANDLERS: UNAUTHENTICATED & NON-DOCTOR ACCESS (401 & 403)
  // ---------------------------------------------------------------------------
  console.log("\n-------------------------------------------------------------------------------");
  console.log("4. VERIFY ROUTE LEVEL AUTHENTICATION & ROLE GUARDS (401 / 403)");
  console.log("-------------------------------------------------------------------------------");

  const { GET: doctorPrescriptionDetailHandler } = await import("../app/api/doctor/prescriptions/[id]/route");
  const { POST: uploadDocHandler } = await import("../app/api/doctor/prescriptions/upload/route");

  // 4a. Unauthenticated GET detail -> 401
  const unauthDetailRes = await doctorPrescriptionDetailHandler(
    new Request("http://localhost:3000/api/doctor/prescriptions/test-id"),
    { params: { id: "test-id" } }
  );
  assert(unauthDetailRes.status === 401, "GET /api/doctor/prescriptions/[id] enforces 401 Unauthorized");

  // 4b. Unauthenticated POST upload -> 401
  const unauthUploadRes = await uploadDocHandler(
    new Request("http://localhost:3000/api/doctor/prescriptions/upload", { method: "POST" })
  );
  assert(unauthUploadRes.status === 401, "POST /api/doctor/prescriptions/upload enforces 401 Unauthorized");

  // 4c. Non-Doctor Role (Admin, Pharmacy, Patient) rejected with 403
  for (const role of [UserRole.ADMIN, UserRole.PHARMACY, UserRole.PATIENT]) {
    let caught403 = false;
    try {
      await requireRole(UserRole.DOCTOR, { id: "user-id", email: "user@test.demo", role });
    } catch (err) {
      if (err instanceof AuthorizationError && err.statusCode === 403) caught403 = true;
    }
    assert(caught403, `Role ${role} rejected from DOCTOR endpoints with HTTP 403 Forbidden`);
  }

  // ---------------------------------------------------------------------------
  // 5. STORAGE ABSTRACTION: VALIDATION & CLOUD STORAGE INTERFACE
  // ---------------------------------------------------------------------------
  console.log("\n-------------------------------------------------------------------------------");
  console.log("5. VERIFY STORAGE ABSTRACTION & DOCUMENT VALIDATION (lib/storage.ts)");
  console.log("-------------------------------------------------------------------------------");

  // 5a. File presence validation
  const missingFileCheck = validateDocumentFile(null);
  assert(!missingFileCheck.valid && missingFileCheck.error === "File is required.", "Missing file rejected correctly");

  // 5b. Empty file buffer validation
  const emptyFileCheck = validateDocumentFile({ buffer: Buffer.from([]), size: 0, originalName: "doc.pdf", mimeType: "application/pdf" });
  assert(!emptyFileCheck.valid && emptyFileCheck.error === "File cannot be empty.", "Empty file rejected correctly");

  // 5c. Oversized file validation (> 5MB)
  const oversizedBuffer = Buffer.alloc(MAX_PRESCRIPTION_FILE_SIZE + 1024);
  const oversizedCheck = validateDocumentFile({
    buffer: oversizedBuffer,
    size: oversizedBuffer.length,
    originalName: "large-scan.pdf",
    mimeType: "application/pdf",
  });
  assert(Boolean(!oversizedCheck.valid && oversizedCheck.error?.includes("File size exceeds")), "Oversized file (>5MB) rejected correctly");

  // 5d. Disallowed file type validation (.exe / script)
  const invalidMimeCheck = validateDocumentFile({
    buffer: Buffer.from("malicious-script-content"),
    size: 24,
    originalName: "malware.exe",
    mimeType: "application/x-msdownload",
  });
  assert(Boolean(!invalidMimeCheck.valid && invalidMimeCheck.error?.includes("Invalid file type")), "Disallowed file type (.exe) rejected correctly");

  // 5e. Valid PDF upload through storageService
  const samplePdfBuffer = Buffer.from("%PDF-1.4 sample clinical prescription document data");
  const uploadResult = await storageService.uploadPrescriptionDocument({
    buffer: samplePdfBuffer,
    originalName: "clinical-rx-scan.pdf",
    mimeType: "application/pdf",
    size: samplePdfBuffer.length,
  });

  assert(Boolean(uploadResult.documentRef), `Generated documentRef: ${uploadResult.documentRef}`);
  assert(uploadResult.documentRef.startsWith("rx-docs/"), "documentRef follows rx-docs/* naming convention");
  assert(uploadResult.mimeType === "application/pdf", "Upload result contains correct MIME type");
  assert(uploadResult.size === samplePdfBuffer.length, "Upload result contains matching byte size");

  // 5f. Get document URL
  const docUrl = await storageService.getDocumentUrl(uploadResult.documentRef);
  assert(Boolean(docUrl), `Document URL resolved safely: ${docUrl}`);

  // ---------------------------------------------------------------------------
  // 6. END-TO-END: CREATE PRESCRIPTION WITH DOCUMENT & VERIFY DETAIL
  // ---------------------------------------------------------------------------
  console.log("\n-------------------------------------------------------------------------------");
  console.log("6. VERIFY END-TO-END: CREATE RX WITH DOCUMENT ATTACHMENT & DETAIL RETRIEVAL");
  console.log("-------------------------------------------------------------------------------");

  const paracetamol = await prisma.medicine.findFirstOrThrow({ where: { name: { contains: "Paracetamol" } } });

  const customDocRef = `rx-docs/day9-test-${Date.now()}.pdf`;
  const createResult = await createDoctorPrescription(doctorSarahDb.id, {
    patientId: patientAliceDb.patientProfile!.id,
    diagnosis: "Day 9 Verification - Acute Sinusitis with Attached Chart",
    documentRef: customDocRef,
    medicines: [
      {
        medicineId: paracetamol.id,
        dosage: "500mg",
        frequency: "1 tablet three times daily",
        duration: "5 days",
      },
    ],
  });

  assert(!("error" in createResult), "Prescription created with documentRef attachment successfully");

  let createdRxId = "";
  if (!("error" in createResult) && createResult.prescription) {
    createdRxId = createResult.prescription.id;
    assert(createResult.prescription.documentRef === customDocRef, "Prescription saved documentRef in database");

    // Fetch detail and verify documentRef is returned
    const createdDetail = await getDoctorPrescriptionDetail(doctorSarahDb.id, createdRxId);
    assert(!("error" in createdDetail), "Retrieved newly created prescription detail");
    if (!("error" in createdDetail)) {
      assert(createdDetail.prescription.documentRef === customDocRef, `Detail view returns stored documentRef: ${createdDetail.prescription.documentRef}`);
      assert(createdDetail.prescription.status === PrescriptionStatus.PENDING, "New prescription status is PENDING");
      assert(createdDetail.prescription.doctor?.name === "Dr. Sarah", `Doctor name resolved correctly: ${createdDetail.prescription.doctor?.name}`);
    }

    // Cleanup created test prescription
    await prisma.prescriptionMedicine.deleteMany({ where: { prescriptionId: createdRxId } });
    await prisma.prescription.delete({ where: { id: createdRxId } });
    console.log(`  ✓ Cleaned up temporary test prescription [ID: ${createdRxId}]`);
  }

  // ---------------------------------------------------------------------------
  // 7. SECURITY & CREDENTIAL SANITIZATION
  // ---------------------------------------------------------------------------
  console.log("\n-------------------------------------------------------------------------------");
  console.log("7. VERIFY SECURITY SANITIZATION (No leaked hashes, credentials, or private secrets)");
  console.log("-------------------------------------------------------------------------------");

  const sarahDetailPayload = JSON.stringify(sarahListResult);
  const uploadResultPayload = JSON.stringify(uploadResult);

  const forbiddenStrings = [
    "password",
    "passwordHash",
    "GCP_PRIVATE_KEY",
    "private_key",
    "client_email",
    "NEXTAUTH_SECRET",
  ];

  for (const str of forbiddenStrings) {
    if (sarahDetailPayload.includes(`"${str}"`) || uploadResultPayload.includes(`"${str}"`)) {
      throw new Error(`❌ Security violation: Sensitive string "${str}" found in API payload!`);
    }
  }
  assert(true, "Zero password hashes, raw GCP private keys, or internal secrets exposed in API responses");

  // ---------------------------------------------------------------------------
  // SUMMARY
  // ---------------------------------------------------------------------------
  console.log("\n===============================================================================");
  console.log(`🎉 ALL ${passedChecks}/${totalChecks} DAY 9 BACKEND & STORAGE VERIFICATION CHECKS PASSED!`);
  console.log("===============================================================================\n");
}

runDay9TestSuite()
  .catch((err) => {
    console.error("\n❌ Day 9 Test Suite Failed:\n", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
