import { UserRole, PrescriptionStatus } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { AuthUser, requireRole, AuthorizationError } from "../lib/permissions";
import { createDoctorPrescription } from "../lib/doctor-service";

async function runDoctorCreatePrescriptionTestSuite() {
  console.log("===============================================================================");
  console.log("🩺 MedEasy Prescription-to-Order Tracking System - Create Prescription Tests");
  console.log("===============================================================================\n");

  // 1. Retrieve test users & profiles from database
  const [adminUserDb, doctorSarahDb, doctorJohnDb, pharmacyUserDb, patientAliceDb, patientEmmaDb] =
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
      prisma.user.findUniqueOrThrow({
        where: { email: "patient.emma@medeasy.demo" },
        include: { patientProfile: true },
      }),
    ]);

  const doctorSarahAuth: AuthUser = {
    id: doctorSarahDb.id,
    email: doctorSarahDb.email,
    role: UserRole.DOCTOR,
    name: "Dr. Sarah",
  };

  const adminAuth: AuthUser = {
    id: adminUserDb.id,
    email: adminUserDb.email,
    role: UserRole.ADMIN,
    name: "Admin",
  };

  const pharmacyAuth: AuthUser = {
    id: pharmacyUserDb.id,
    email: pharmacyUserDb.email,
    role: UserRole.PHARMACY,
    name: "Central Pharmacy",
  };

  const patientAuth: AuthUser = {
    id: patientAliceDb.id,
    email: patientAliceDb.email,
    role: UserRole.PATIENT,
    name: "Alice",
  };

  // Retrieve valid medicines from catalog
  const [paracetamol, amoxicillin] = await Promise.all([
    prisma.medicine.findFirstOrThrow({ where: { name: { contains: "Paracetamol" } } }),
    prisma.medicine.findFirstOrThrow({ where: { name: { contains: "Amoxicillin" } } }),
  ]);

  const createdPrescriptionIds: string[] = [];

  // ---------------------------------------------------------------------------
  // 1. UNAUTHENTICATED REQUEST REJECTION (HTTP 401)
  // ---------------------------------------------------------------------------
  console.log("-------------------------------------------------------------------------------");
  console.log("1. VERIFY 401 UNAUTHORIZED ON MISSING SESSION");
  console.log("-------------------------------------------------------------------------------");

  const { POST: createPrescriptionHandler } = await import("../app/api/doctor/prescriptions/route");

  const unauthReq = new Request("http://localhost:3000/api/doctor/prescriptions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      patientId: patientAliceDb.patientProfile!.id,
      diagnosis: "Test Diagnosis",
      medicines: [
        {
          medicineId: paracetamol.id,
          dosage: "500mg",
          frequency: "1 tab daily",
          duration: "3 days",
        },
      ],
    }),
  });

  const unauthRes = await createPrescriptionHandler(unauthReq);
  if (unauthRes.status !== 401) {
    throw new Error(`❌ Expected 401 for unauthenticated prescription creation, got ${unauthRes.status}`);
  }
  console.log("  ✓ POST /api/doctor/prescriptions enforces 401 Unauthorized for unauthenticated requests");

  // ---------------------------------------------------------------------------
  // 2. WRONG-ROLE REJECTION (HTTP 403 FOR NON-DOCTORS)
  // ---------------------------------------------------------------------------
  console.log("\n-------------------------------------------------------------------------------");
  console.log("2. VERIFY 403 FORBIDDEN ON NON-DOCTOR ROLES (Admin, Pharmacy, Patient)");
  console.log("-------------------------------------------------------------------------------");

  const nonDoctorUsers = [
    { label: "Admin", auth: adminAuth },
    { label: "Pharmacy", auth: pharmacyAuth },
    { label: "Patient", auth: patientAuth },
  ];

  for (const nonDoc of nonDoctorUsers) {
    let forbiddenCaught = false;
    try {
      await requireRole(UserRole.DOCTOR, nonDoc.auth);
    } catch (err) {
      if (err instanceof AuthorizationError && err.statusCode === 403) {
        forbiddenCaught = true;
      }
    }

    if (!forbiddenCaught) {
      throw new Error(`❌ Non-doctor ${nonDoc.label} was not rejected with 403!`);
    }
    console.log(`  ✓ ${nonDoc.label.padEnd(8)} correctly rejected with HTTP 403 Forbidden`);
  }

  // ---------------------------------------------------------------------------
  // 3. VALID MULTI-MEDICINE PRESCRIPTION CREATION
  // ---------------------------------------------------------------------------
  console.log("\n-------------------------------------------------------------------------------");
  console.log("3. VERIFY VALID MULTI-MEDICINE PRESCRIPTION CREATION");
  console.log("-------------------------------------------------------------------------------");

  const validPayload = {
    patientId: patientAliceDb.patientProfile!.id,
    diagnosis: "Acute Pharyngitis with Mild Fever",
    documentRef: "rx-docs/alice-pharyngitis-2026.pdf",
    medicines: [
      {
        medicineId: paracetamol.id,
        dosage: "500mg",
        frequency: "1 tablet three times daily after food",
        duration: "5 days",
      },
      {
        medicineId: amoxicillin.id,
        dosage: "500mg",
        frequency: "1 capsule twice daily",
        duration: "7 days",
      },
    ],
  };

  const createResult = await createDoctorPrescription(doctorSarahDb.id, validPayload);
  if (!createResult.success || !createResult.prescription) {
    throw new Error(`❌ Valid prescription creation failed: ${createResult.error}`);
  }

  const newRx = createResult.prescription;
  createdPrescriptionIds.push(newRx.id);

  // Assertions on returned prescription
  if (newRx.doctorId !== doctorSarahDb.doctorProfile!.id) {
    throw new Error(`❌ Prescription doctorId mismatch: expected ${doctorSarahDb.doctorProfile!.id}, got ${newRx.doctorId}`);
  }
  if (newRx.patientId !== patientAliceDb.patientProfile!.id) {
    throw new Error(`❌ Prescription patientId mismatch: expected ${patientAliceDb.patientProfile!.id}, got ${newRx.patientId}`);
  }
  if (newRx.status !== PrescriptionStatus.PENDING) {
    throw new Error(`❌ Prescription initial status must be PENDING, got ${newRx.status}`);
  }
  if (newRx.diagnosis !== "Acute Pharyngitis with Mild Fever") {
    throw new Error(`❌ Prescription diagnosis mismatch: got "${newRx.diagnosis}"`);
  }
  if (newRx.prescriptionMedicines.length !== 2) {
    throw new Error(`❌ Expected 2 prescriptionMedicines, got ${newRx.prescriptionMedicines.length}`);
  }

  // Verify in database
  const dbRecord = await prisma.prescription.findUnique({
    where: { id: newRx.id },
    include: { prescriptionMedicines: { include: { medicine: true } } },
  });

  if (!dbRecord || dbRecord.prescriptionMedicines.length !== 2) {
    throw new Error("❌ Database verification failed: Prescription or medicines not saved properly");
  }

  console.log(`  ✓ Successfully created Prescription [ID: ${newRx.id}]`);
  console.log(`    - Status   : ${newRx.status} (Strictly PENDING)`);
  console.log(`    - Doctor   : ${newRx.doctor.specialization} [License: ${newRx.doctor.licenseNumber}]`);
  console.log(`    - Patient  : ${newRx.patient.name} (Age: ${newRx.patient.age})`);
  console.log(`    - Medicines: ${newRx.prescriptionMedicines.map((m) => m.medicine.name).join(", ")}`);

  // ---------------------------------------------------------------------------
  // 4. INVALID / MISSING PATIENT VALIDATION
  // ---------------------------------------------------------------------------
  console.log("\n-------------------------------------------------------------------------------");
  console.log("4. VERIFY INVALID & MISSING PATIENT REJECTION");
  console.log("-------------------------------------------------------------------------------");

  // 4a. Missing patientId
  const missingPatientResult = await createDoctorPrescription(doctorSarahDb.id, {
    patientId: "",
    diagnosis: "Test Diagnosis",
    medicines: [
      {
        medicineId: paracetamol.id,
        dosage: "500mg",
        frequency: "1 tab daily",
        duration: "3 days",
      },
    ],
  });
  if (!("error" in missingPatientResult) || missingPatientResult.statusCode !== 400) {
    throw new Error("❌ Missing patientId did not return HTTP 400 Bad Request!");
  }
  console.log(`  ✓ Missing patientId rejected: "${missingPatientResult.error}"`);

  // 4b. Nonexistent patientId
  const nonExistentPatientResult = await createDoctorPrescription(doctorSarahDb.id, {
    patientId: "nonexistent-patient-99999",
    diagnosis: "Test Diagnosis",
    medicines: [
      {
        medicineId: paracetamol.id,
        dosage: "500mg",
        frequency: "1 tab daily",
        duration: "3 days",
      },
    ],
  });
  if (!("error" in nonExistentPatientResult) || nonExistentPatientResult.statusCode !== 404) {
    throw new Error("❌ Non-existent patientId did not return HTTP 404 Not Found!");
  }
  console.log(`  ✓ Non-existent patientId rejected: "${nonExistentPatientResult.error}"`);

  // ---------------------------------------------------------------------------
  // 5. UNLINKED PATIENT ROSTER REJECTION (DoctorPatient Constraint)
  // ---------------------------------------------------------------------------
  console.log("\n-------------------------------------------------------------------------------");
  console.log("5. VERIFY UNLINKED PATIENT ROSTER REJECTION");
  console.log("-------------------------------------------------------------------------------");

  // In seed data: Emma Watson is assigned to Dr. John only, NOT Dr. Sarah
  const unlinkedPatientResult = await createDoctorPrescription(doctorSarahDb.id, {
    patientId: patientEmmaDb.patientProfile!.id,
    diagnosis: "Seasonal Allergies",
    medicines: [
      {
        medicineId: paracetamol.id,
        dosage: "500mg",
        frequency: "1 tab daily",
        duration: "3 days",
      },
    ],
  });

  if (!("error" in unlinkedPatientResult) || unlinkedPatientResult.statusCode !== 403) {
    throw new Error(`❌ Prescribing to unlinked patient did not return HTTP 403 Forbidden! Got: ${JSON.stringify(unlinkedPatientResult)}`);
  }
  console.log(`  ✓ Unlinked patient rejected with HTTP 403 Forbidden: "${unlinkedPatientResult.error}"`);

  // ---------------------------------------------------------------------------
  // 6. MISSING & EMPTY MEDICINES ARRAY REJECTION
  // ---------------------------------------------------------------------------
  console.log("\n-------------------------------------------------------------------------------");
  console.log("6. VERIFY EMPTY MEDICINES ARRAY REJECTION");
  console.log("-------------------------------------------------------------------------------");

  const emptyMedsResult = await createDoctorPrescription(doctorSarahDb.id, {
    patientId: patientAliceDb.patientProfile!.id,
    diagnosis: "Mild Headache",
    medicines: [],
  });

  if (!("error" in emptyMedsResult) || emptyMedsResult.statusCode !== 400) {
    throw new Error("❌ Empty medicines array did not return HTTP 400 Bad Request!");
  }
  console.log(`  ✓ Empty medicines array rejected: "${emptyMedsResult.error}"`);

  // ---------------------------------------------------------------------------
  // 7. MISSING MEDICINE ITEM FIELDS REJECTION
  // ---------------------------------------------------------------------------
  console.log("\n-------------------------------------------------------------------------------");
  console.log("7. VERIFY INCOMPLETE MEDICINE ATTRIBUTES REJECTION");
  console.log("-------------------------------------------------------------------------------");

  const incompleteMedResult = await createDoctorPrescription(doctorSarahDb.id, {
    patientId: patientAliceDb.patientProfile!.id,
    diagnosis: "Mild Headache",
    medicines: [
      {
        medicineId: paracetamol.id,
        dosage: "", // Missing dosage
        frequency: "1 tab daily",
        duration: "3 days",
      },
    ],
  });

  if (!("error" in incompleteMedResult) || incompleteMedResult.statusCode !== 400) {
    throw new Error("❌ Missing dosage did not return HTTP 400 Bad Request!");
  }
  console.log(`  ✓ Incomplete medication attributes rejected: "${incompleteMedResult.error}"`);

  // ---------------------------------------------------------------------------
  // 8. INVALID MEDICINE CATALOG ID REJECTION
  // ---------------------------------------------------------------------------
  console.log("\n-------------------------------------------------------------------------------");
  console.log("8. VERIFY INVALID MEDICINE CATALOG ID REJECTION");
  console.log("-------------------------------------------------------------------------------");

  const invalidMedResult = await createDoctorPrescription(doctorSarahDb.id, {
    patientId: patientAliceDb.patientProfile!.id,
    diagnosis: "Infection",
    medicines: [
      {
        medicineId: "nonexistent-med-id-99999",
        dosage: "500mg",
        frequency: "1 tab daily",
        duration: "3 days",
      },
    ],
  });

  if (!("error" in invalidMedResult) || invalidMedResult.statusCode !== 400) {
    throw new Error("❌ Invalid medicine ID did not return HTTP 400 Bad Request!");
  }
  console.log(`  ✓ Non-existent medicine ID rejected: "${invalidMedResult.error}"`);

  // ---------------------------------------------------------------------------
  // 9. DUPLICATE MEDICINE IN SINGLE PRESCRIPTION REJECTION
  // ---------------------------------------------------------------------------
  console.log("\n-------------------------------------------------------------------------------");
  console.log("9. VERIFY DUPLICATE MEDICINE REJECTION IN SAME PRESCRIPTION");
  console.log("-------------------------------------------------------------------------------");

  const duplicateMedResult = await createDoctorPrescription(doctorSarahDb.id, {
    patientId: patientAliceDb.patientProfile!.id,
    diagnosis: "Pain & Fever",
    medicines: [
      {
        medicineId: paracetamol.id,
        dosage: "500mg",
        frequency: "morning",
        duration: "3 days",
      },
      {
        medicineId: paracetamol.id, // Duplicate medicineId
        dosage: "500mg",
        frequency: "evening",
        duration: "3 days",
      },
    ],
  });

  if (!("error" in duplicateMedResult) || duplicateMedResult.statusCode !== 400) {
    throw new Error("❌ Duplicate medicine ID in single prescription was not rejected with 400!");
  }
  console.log(`  ✓ Duplicate medicine in same prescription rejected: "${duplicateMedResult.error}"`);

  // ---------------------------------------------------------------------------
  // 10. CLIENT-SUPPLIED STATUS & DOCTOR ID OVERRIDE SANITIZATION
  // ---------------------------------------------------------------------------
  console.log("\n-------------------------------------------------------------------------------");
  console.log("10. VERIFY CLIENT STATUS / DOCTORID OVERRIDE SANITIZATION");
  console.log("-------------------------------------------------------------------------------");

  // An attacker clinician sends status: "FILLED" and doctorId: "fake-doctor-id"
  const maliciousPayload = {
    patientId: patientAliceDb.patientProfile!.id,
    diagnosis: "Malicious Attempt",
    status: PrescriptionStatus.FILLED, // Attempting to bypass PENDING
    doctorId: doctorJohnDb.doctorProfile!.id, // Attempting to impersonate Dr. John
    medicines: [
      {
        medicineId: paracetamol.id,
        dosage: "500mg",
        frequency: "1 tab daily",
        duration: "1 day",
      },
    ],
  } as any;

  const sanitizeResult = await createDoctorPrescription(doctorSarahDb.id, maliciousPayload);
  if (!sanitizeResult.success || !sanitizeResult.prescription) {
    throw new Error(`❌ Prescription creation failed: ${sanitizeResult.error}`);
  }

  const sanitizedRx = sanitizeResult.prescription;
  createdPrescriptionIds.push(sanitizedRx.id);

  if (sanitizedRx.status !== PrescriptionStatus.PENDING) {
    throw new Error(`❌ Security violation: Client successfully forged initial status to ${sanitizedRx.status}!`);
  }
  if (sanitizedRx.doctorId !== doctorSarahDb.doctorProfile!.id) {
    throw new Error(`❌ Security violation: Client successfully forged doctorId to ${sanitizedRx.doctorId}!`);
  }

  console.log("  ✓ Client-supplied forged status ('FILLED') was ignored -> Enforced: 'PENDING'");
  console.log("  ✓ Client-supplied forged doctorId was ignored -> Enforced: authenticated doctorId");

  // ---------------------------------------------------------------------------
  // 11. CLEANUP TEMPORARY TEST DATA
  // ---------------------------------------------------------------------------
  console.log("\n-------------------------------------------------------------------------------");
  console.log("11. CLEANUP TEMPORARY TEST PRESCRIPTIONS");
  console.log("-------------------------------------------------------------------------------");

  for (const rxId of createdPrescriptionIds) {
    await prisma.prescriptionMedicine.deleteMany({ where: { prescriptionId: rxId } });
    await prisma.prescription.delete({ where: { id: rxId } });
  }

  console.log(`  ✓ Cleaned up ${createdPrescriptionIds.length} temporary test prescription records from database.`);

  console.log("\n===============================================================================");
  console.log("🎉 ALL DOCTOR CREATE PRESCRIPTION TESTS PASSED WITH 100% SUCCESS!");
  console.log("===============================================================================");
}

runDoctorCreatePrescriptionTestSuite()
  .catch((err) => {
    console.error("\n❌ Test Suite Failed with Error:\n", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
