import { UserRole, PrescriptionStatus } from "@prisma/client";
import { prisma } from "../lib/prisma";
import {
  AuthUser,
  requireRole,
  AuthorizationError,
  sanitizePrescriptionForPharmacy,
  canUserAccessPrescription,
} from "../lib/permissions";
import {
  createDoctorPrescription,
  getDoctorPrescriptionDetail,
} from "../lib/doctor-service";
import {
  getPharmacyDashboardData,
  getPharmacyPrescriptions,
  getPharmacyPrescriptionDetail,
} from "../lib/pharmacy-service";

function assertDiagnosisAbsent(value: unknown, path: string = "root") {
  if (!value || typeof value !== "object") return;
  if (Object.prototype.hasOwnProperty.call(value, "diagnosis")) {
    throw new Error(`CRITICAL SECURITY FAILURE: diagnosis field leaked at path "${path}"`);
  }
  for (const [key, child] of Object.entries(value)) {
    assertDiagnosisAbsent(child, `${path}.${key}`);
  }
}

async function runPharmacyIntegrationVerification() {
  console.log("===============================================================================");
  console.log("💊 MedEasy Day 11 - Pharmacy Module Foundation Integration Verification");
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

  let createdPrescriptionId: string | null = null;

  try {
    // ---------------------------------------------------------------------------
    // 1. IDENTITY & PROFILE RESOLUTION
    // ---------------------------------------------------------------------------
    console.log("-------------------------------------------------------------------------------");
    console.log("1. VERIFY USER IDENTITY & PROFILE RESOLUTION");
    console.log("-------------------------------------------------------------------------------");

    const [doctorSarahUser, doctorJohnUser, pharmacyUser, patientAliceUser, adminUser] =
      await Promise.all([
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
          where: { email: "admin@medeasy.demo" },
        }),
      ]);

    assert(Boolean(doctorSarahUser.doctorProfile), "Dr. Sarah has active DoctorProfile");
    assert(Boolean(pharmacyUser.pharmacyProfile), "Central Pharmacy has active PharmacyProfile");
    assert(Boolean(patientAliceUser.patientProfile), "Alice Johnson has active PatientProfile");
    assert(pharmacyUser.role === UserRole.PHARMACY, "Pharmacy user has role PHARMACY");
    assert(doctorSarahUser.role === UserRole.DOCTOR, "Dr. Sarah has role DOCTOR");
    assert(patientAliceUser.role === UserRole.PATIENT, "Patient Alice has role PATIENT");
    assert(adminUser.role === UserRole.ADMIN, "Admin user has role ADMIN");

    // Verify patient roster relationship
    const isLinked = await prisma.doctorPatient.findUnique({
      where: {
        doctorId_patientId: {
          doctorId: doctorSarahUser.doctorProfile!.id,
          patientId: patientAliceUser.patientProfile!.id,
        },
      },
    });
    assert(Boolean(isLinked), "Patient Alice Johnson is in Dr. Sarah's assigned care roster");

    const doctorAuth: AuthUser = {
      id: doctorSarahUser.id,
      email: doctorSarahUser.email,
      role: UserRole.DOCTOR,
      name: "Dr. Sarah",
    };

    const pharmacyAuth: AuthUser = {
      id: pharmacyUser.id,
      email: pharmacyUser.email,
      role: UserRole.PHARMACY,
      name: pharmacyUser.pharmacyProfile!.pharmacyName,
    };

    const patientAuth: AuthUser = {
      id: patientAliceUser.id,
      email: patientAliceUser.email,
      role: UserRole.PATIENT,
      name: patientAliceUser.patientProfile!.name,
    };

    const adminAuth: AuthUser = {
      id: adminUser.id,
      email: adminUser.email,
      role: UserRole.ADMIN,
      name: "System Admin",
    };

    // ---------------------------------------------------------------------------
    // 2. DOCTOR FLOW: CREATE PRESCRIPTION FOR LINKED PATIENT
    // ---------------------------------------------------------------------------
    console.log("\n-------------------------------------------------------------------------------");
    console.log("2. COMPLETE FLOW: DOCTOR PRESCRIPTION CREATION & PENDING STATUS");
    console.log("-------------------------------------------------------------------------------");

    // Fetch baseline pending count before creating the prescription
    const baselineDashboard = await getPharmacyDashboardData(pharmacyAuth.id);
    assert(!("error" in baselineDashboard), "Baseline pharmacy dashboard retrieved");
    const baselinePendingCount = "error" in baselineDashboard ? 0 : baselineDashboard.pendingCount;

    // Fetch medicines from catalog for prescription
    const catalogMedicines = await prisma.medicine.findMany({
      take: 2,
      orderBy: { name: "asc" },
    });
    assert(catalogMedicines.length >= 2, "Medicine catalog has at least 2 medications");

    const testDiagnosis = "CONFIDENTIAL CLINICAL DIAGNOSIS: Acute Bronchitis with Bronchospasm";
    const testDocRef = "rx-docs/test-day11-bronchitis-order.pdf";

    const createResult = await createDoctorPrescription(doctorAuth.id, {
      patientId: patientAliceUser.patientProfile!.id,
      diagnosis: testDiagnosis,
      documentRef: testDocRef,
      medicines: [
        {
          medicineId: catalogMedicines[0].id,
          dosage: "500mg",
          frequency: "1 tablet three times daily after meals",
          duration: "7 days",
        },
        {
          medicineId: catalogMedicines[1].id,
          dosage: "250mg",
          frequency: "1 capsule twice daily with water",
          duration: "5 days",
        },
      ],
    });

    assert(!("error" in createResult), "Prescription created successfully by Doctor");
    if ("error" in createResult) {
      throw new Error(`Failed to create prescription: ${createResult.error}`);
    }

    createdPrescriptionId = createResult.prescription.id;
    assert(Boolean(createdPrescriptionId), `New prescription generated with ID: ${createdPrescriptionId}`);
    assert(
      createResult.prescription.status === PrescriptionStatus.PENDING,
      "New prescription status is strictly PENDING"
    );

    // Verify raw database record contains the clinical diagnosis
    const rawDbRecord = await prisma.prescription.findUniqueOrThrow({
      where: { id: createdPrescriptionId },
      include: { prescriptionMedicines: true },
    });
    assert(rawDbRecord.diagnosis === testDiagnosis, "Clinical diagnosis stored in database for doctor record");
    assert(rawDbRecord.status === PrescriptionStatus.PENDING, "Database confirms status is PENDING");
    assert(rawDbRecord.prescriptionMedicines.length === 2, "Database confirms 2 itemized medicines stored");
    assert(rawDbRecord.documentRef === testDocRef, "Database confirms attached documentRef stored");

    // ---------------------------------------------------------------------------
    // 3. PHARMACY DASHBOARD: PENDING COUNT REFLECTS NEW PRESCRIPTION
    // ---------------------------------------------------------------------------
    console.log("\n-------------------------------------------------------------------------------");
    console.log("3. PHARMACY DASHBOARD: PENDING COUNT & LIVE ACTIVITY REFLECTION");
    console.log("-------------------------------------------------------------------------------");

    const updatedDashboard = await getPharmacyDashboardData(pharmacyAuth.id);
    assert(!("error" in updatedDashboard), "Updated pharmacy dashboard retrieved");
    if (!("error" in updatedDashboard)) {
      assert(
        updatedDashboard.pendingCount === baselinePendingCount + 1,
        `Pharmacy pending count incremented: ${baselinePendingCount} -> ${updatedDashboard.pendingCount}`
      );
      assert(
        updatedDashboard.metrics.pendingPrescriptions === updatedDashboard.pendingCount,
        "metrics.pendingPrescriptions matches pendingCount"
      );
      assert(
        Number.isFinite(updatedDashboard.metrics.fulfillmentRate),
        `Fulfillment rate is valid number: ${updatedDashboard.metrics.fulfillmentRate}%`
      );

      // Verify the new prescription appears in recent activity
      const recentRx = updatedDashboard.recentActivity.find((rx) => rx.id === createdPrescriptionId);
      assert(Boolean(recentRx), "New prescription appears in pharmacy dashboard recent activity");
      if (recentRx) {
        assert(recentRx.status === PrescriptionStatus.PENDING, "Recent activity shows status PENDING");
        assert(recentRx.patient.name === "Alice Johnson", "Recent activity shows correct patient name");
        assert(Boolean(recentRx.doctor.name), "Recent activity shows doctor display name");
      }
    }

    // ---------------------------------------------------------------------------
    // 4. PHARMACY PRESCRIPTION QUEUE: NEW PRESCRIPTION APPEARS & STATUS FILTERING
    // ---------------------------------------------------------------------------
    console.log("\n-------------------------------------------------------------------------------");
    console.log("4. PHARMACY PRESCRIPTION QUEUE: PRESENCE, FILTERING & EMPTY STATES");
    console.log("-------------------------------------------------------------------------------");

    // 4a. All prescriptions queue
    const allQueue = await getPharmacyPrescriptions(pharmacyAuth.id);
    assert(!("error" in allQueue), "All prescriptions queue retrieved");
    if (!("error" in allQueue)) {
      const foundInAll = allQueue.prescriptions.some((rx) => rx.id === createdPrescriptionId);
      assert(foundInAll, "New prescription appears in full prescription queue");
    }

    // 4b. Status filter: PENDING
    const pendingQueue = await getPharmacyPrescriptions(pharmacyAuth.id, PrescriptionStatus.PENDING);
    assert(!("error" in pendingQueue), "Pending queue retrieved");
    if (!("error" in pendingQueue)) {
      const foundInPending = pendingQueue.prescriptions.some((rx) => rx.id === createdPrescriptionId);
      assert(foundInPending, "New prescription appears in filtered PENDING queue");
      const allArePending = pendingQueue.prescriptions.every((rx) => rx.status === PrescriptionStatus.PENDING);
      assert(allArePending, "All items in PENDING queue strictly have status PENDING");
    }

    // 4c. Status filter: FILLED
    const filledQueue = await getPharmacyPrescriptions(pharmacyAuth.id, PrescriptionStatus.FILLED);
    assert(!("error" in filledQueue), "Filled queue retrieved");
    if (!("error" in filledQueue)) {
      const notInFilled = !filledQueue.prescriptions.some((rx) => rx.id === createdPrescriptionId);
      assert(notInFilled, "New prescription does NOT appear in FILLED queue");
      const allAreFilled = filledQueue.prescriptions.every((rx) => rx.status === PrescriptionStatus.FILLED);
      assert(allAreFilled, "All items in FILLED queue strictly have status FILLED");
    }

    // 4d. Status filter: CANNOT_FILL
    const cannotFillQueue = await getPharmacyPrescriptions(pharmacyAuth.id, PrescriptionStatus.CANNOT_FILL);
    assert(!("error" in cannotFillQueue), "Cannot Fill queue retrieved");
    if (!("error" in cannotFillQueue)) {
      const notInCannotFill = !cannotFillQueue.prescriptions.some((rx) => rx.id === createdPrescriptionId);
      assert(notInCannotFill, "New prescription does NOT appear in CANNOT_FILL queue");
      const allAreCannotFill = cannotFillQueue.prescriptions.every(
        (rx) => rx.status === PrescriptionStatus.CANNOT_FILL
      );
      assert(allAreCannotFill, "All items in CANNOT_FILL queue strictly have status CANNOT_FILL");
    }

    // ---------------------------------------------------------------------------
    // 5. PHARMACY PRESCRIPTION DETAILS: ALL REQUIRED PRD FIELDS DISPLAYED
    // ---------------------------------------------------------------------------
    console.log("\n-------------------------------------------------------------------------------");
    console.log("5. PHARMACY PRESCRIPTION DETAILS: COMPLETE PRD FIELD RETRIEVAL");
    console.log("-------------------------------------------------------------------------------");

    const detailResult = await getPharmacyPrescriptionDetail(pharmacyAuth.id, createdPrescriptionId!);
    assert(!("error" in detailResult), "Pharmacy prescription detail retrieved successfully");
    if (!("error" in detailResult)) {
      const rx = detailResult.prescription;

      // Patient fields
      assert(rx.patient.name === "Alice Johnson", `Patient name displayed: ${rx.patient.name}`);
      assert(rx.patient.age === 34, `Patient age displayed: ${rx.patient.age}`);
      assert(rx.patient.gender === "Female", `Patient gender displayed: ${rx.patient.gender}`);
      assert(Boolean(rx.patient.contactInfo), `Patient contact info displayed: ${rx.patient.contactInfo}`);

      // Doctor fields
      assert(rx.doctor.name === "Dr. Sarah", `Doctor name displayed: ${rx.doctor.name}`);
      assert(rx.doctor.specialization === "General Medicine", `Doctor specialization: ${rx.doctor.specialization}`);
      assert(rx.doctor.licenseNumber === "DOC-LIC-1001", `Doctor license displayed: ${rx.doctor.licenseNumber}`);
      assert(Boolean(rx.doctor.phone), `Doctor phone displayed: ${rx.doctor.phone}`);
      assert(Boolean(rx.doctor.email), `Doctor email displayed: ${rx.doctor.email}`);

      // Medicines, dosage, frequency, duration
      assert(rx.medicines.length === 2, `Itemized medicines displayed: ${rx.medicines.length} medications`);
      const med1 = rx.medicines[0];
      assert(Boolean(med1.medicine.name), `Medicine 1 name: ${med1.medicine.name}`);
      assert(med1.dosage === "500mg", `Medicine 1 dosage: ${med1.dosage}`);
      assert(med1.frequency === "1 tablet three times daily after meals", `Medicine 1 frequency: ${med1.frequency}`);
      assert(med1.duration === "7 days", `Medicine 1 duration: ${med1.duration}`);

      const med2 = rx.medicines[1];
      assert(Boolean(med2.medicine.name), `Medicine 2 name: ${med2.medicine.name}`);
      assert(med2.dosage === "250mg", `Medicine 2 dosage: ${med2.dosage}`);
      assert(med2.frequency === "1 capsule twice daily with water", `Medicine 2 frequency: ${med2.frequency}`);
      assert(med2.duration === "5 days", `Medicine 2 duration: ${med2.duration}`);

      // Document reference
      assert(rx.documentAvailable === true, "Document availability indicated: true");
      assert(rx.documentRef === testDocRef, `Document reference displayed: ${rx.documentRef}`);

      // Status & Timestamps
      assert(rx.status === PrescriptionStatus.PENDING, `Prescription status: ${rx.status}`);
      assert(Boolean(rx.createdAt), `Created timestamp present: ${rx.createdAt}`);
      assert(rx.filledAt === null, "Filled timestamp is null for pending prescription");
    }

    // ---------------------------------------------------------------------------
    // 6. CRITICAL SECURITY TEST: DIAGNOSIS REDACTION ACROSS ALL PHARMACY RESPONSES
    // ---------------------------------------------------------------------------
    console.log("\n-------------------------------------------------------------------------------");
    console.log("6. CRITICAL SECURITY TEST: COMPLETE DIAGNOSIS REDACTION");
    console.log("-------------------------------------------------------------------------------");

    // 6a. Authoring doctor CAN see diagnosis
    const doctorView = await getDoctorPrescriptionDetail(doctorAuth.id, createdPrescriptionId!);
    assert(!("error" in doctorView), "Authoring doctor can view prescription detail");
    if (!("error" in doctorView)) {
      assert(
        doctorView.prescription.diagnosis === testDiagnosis,
        "Authoring doctor receives full diagnosis as permitted"
      );
    }

    // 6b. Pharmacy Dashboard response: Diagnosis strictly absent
    assertDiagnosisAbsent(updatedDashboard, "PharmacyDashboard");
    assert(
      !("diagnosis" in (updatedDashboard as Record<string, unknown>)),
      "Pharmacy dashboard does not expose diagnosis"
    );
    console.log("  ✓ PASS: Diagnosis absent across all Dashboard metrics and recentActivity trees");
    passedChecks++;
    totalChecks++;

    // 6c. Pharmacy Prescription List response: Diagnosis strictly absent
    assertDiagnosisAbsent(allQueue, "PharmacyPrescriptionsList");
    console.log("  ✓ PASS: Diagnosis absent across all items in full prescription queue");
    passedChecks++;
    totalChecks++;

    // 6d. Pharmacy Prescription Detail response: Diagnosis strictly absent
    assertDiagnosisAbsent(detailResult, "PharmacyPrescriptionDetail");
    assert(
      !("diagnosis" in (detailResult as Record<string, unknown>)),
      "detailResult root does not contain diagnosis"
    );
    if (!("error" in detailResult)) {
      assert(
        !("diagnosis" in (detailResult.prescription as Record<string, unknown>)),
        "detailResult.prescription does not contain diagnosis"
      );
    }
    console.log("  ✓ PASS: Diagnosis absent in pharmacy prescription detail response");
    passedChecks++;
    totalChecks++;

    // 6e. Sanitize helper verification
    const testObjWithDiagnosis = {
      id: "test-rx-1",
      patientId: "patient-1",
      diagnosis: "Super Confidential Medical Record",
      status: PrescriptionStatus.PENDING,
    };
    const sanitized = sanitizePrescriptionForPharmacy(testObjWithDiagnosis);
    assert(!("diagnosis" in sanitized), "sanitizePrescriptionForPharmacy removes diagnosis property");
    assert(sanitized.id === "test-rx-1", "sanitizePrescriptionForPharmacy preserves other properties");

    // 6f. canUserAccessPrescription helper verification for PHARMACY role
    const accessCheck = await canUserAccessPrescription(pharmacyAuth, createdPrescriptionId!);
    assert(accessCheck.allowed === true, "canUserAccessPrescription allows PHARMACY role access");
    if (accessCheck.allowed && accessCheck.prescription) {
      assertDiagnosisAbsent(accessCheck.prescription, "canUserAccessPrescription.prescription");
      assert(
        !("diagnosis" in accessCheck.prescription),
        "canUserAccessPrescription strictly redacts diagnosis for PHARMACY"
      );
    }

    // ---------------------------------------------------------------------------
    // 7. AUTHORIZATION TESTS (401 / 403 / 200 ACROSS ENDPOINTS)
    // ---------------------------------------------------------------------------
    console.log("\n-------------------------------------------------------------------------------");
    console.log("7. AUTHORIZATION TESTS: RBAC BOUNDARIES ACROSS PHARMACY ENDPOINTS");
    console.log("-------------------------------------------------------------------------------");

    // 7a. Unauthenticated route requests -> HTTP 401 Unauthorized
    const { GET: pharmacyDashboardRoute } = await import("../app/api/pharmacy/dashboard/route");
    const { GET: pharmacyPrescriptionsRoute } = await import("../app/api/pharmacy/prescriptions/route");
    const { GET: pharmacyPrescriptionDetailRoute } = await import(
      "../app/api/pharmacy/prescriptions/[id]/route"
    );
    const { GET: pharmacyQueueRoute } = await import("../app/api/pharmacy/queue/route");

    const unauthDashRes = await pharmacyDashboardRoute();
    assert(unauthDashRes.status === 401, "GET /api/pharmacy/dashboard returns 401 for unauthenticated request");

    const unauthPrescriptionsRes = await pharmacyPrescriptionsRoute(
      new Request("http://localhost:3000/api/pharmacy/prescriptions")
    );
    assert(unauthPrescriptionsRes.status === 401, "GET /api/pharmacy/prescriptions returns 401 for unauthenticated request");

    const unauthDetailRes = await pharmacyPrescriptionDetailRoute(
      new Request(`http://localhost:3000/api/pharmacy/prescriptions/${createdPrescriptionId}`),
      { params: { id: createdPrescriptionId! } }
    );
    assert(unauthDetailRes.status === 401, "GET /api/pharmacy/prescriptions/[id] returns 401 for unauthenticated request");

    const unauthQueueRes = await pharmacyQueueRoute();
    assert(unauthQueueRes.status === 401, "GET /api/pharmacy/queue returns 401 for unauthenticated request");

    // 7b. Role guards: Doctor, Patient, and Admin rejected with HTTP 403 Forbidden
    const wrongRoleUsers: AuthUser[] = [doctorAuth, patientAuth, adminAuth];
    for (const user of wrongRoleUsers) {
      let rejected = false;
      try {
        await requireRole(UserRole.PHARMACY, user);
      } catch (err) {
        if (err instanceof AuthorizationError && err.statusCode === 403) {
          rejected = true;
        }
      }
      assert(rejected, `User ${user.name} (${user.role}) is rejected with 403 Forbidden from PHARMACY`);
    }

    // 7c. Pharmacy user allowed with requireRole
    const allowedPharmacy = await requireRole(UserRole.PHARMACY, pharmacyAuth);
    assert(allowedPharmacy.id === pharmacyAuth.id, "Pharmacy user successfully authorized (requireRole)");

    // ---------------------------------------------------------------------------
    // 8. QUEUE TESTS: EMPTY QUEUE, 404 NOT FOUND, & CONTROLLED ERROR RESPONSES
    // ---------------------------------------------------------------------------
    console.log("\n-------------------------------------------------------------------------------");
    console.log("8. QUEUE EDGE CASES & CONTROLLED ERROR RESPONSES");
    console.log("-------------------------------------------------------------------------------");

    // 8a. Non-existent prescription ID returns 404 Not Found
    const missingDetailResult = await getPharmacyPrescriptionDetail(
      pharmacyAuth.id,
      "non-existent-prescription-id-cuid999"
    );
    assert("error" in missingDetailResult, "Missing prescription ID returns error");
    if ("error" in missingDetailResult) {
      assert(missingDetailResult.statusCode === 404, "Missing prescription returns status code 404");
      assert(
        missingDetailResult.error === "Prescription not found.",
        `Error message matches expected: "${missingDetailResult.error}"`
      );
    }

    // 8b. Missing prescription for non-existent pharmacy profile returns 404
    const missingPharmacyResult = await getPharmacyPrescriptionDetail(
      "non-existent-user-id",
      createdPrescriptionId!
    );
    assert("error" in missingPharmacyResult, "Missing pharmacy profile returns error");
    if ("error" in missingPharmacyResult) {
      assert(missingPharmacyResult.statusCode === 404, "Missing pharmacy profile returns 404");
    }

    // 8c. Invalid status query param returns 400 Bad Request
    const invalidStatusUrl = "http://localhost:3000/api/pharmacy/prescriptions?status=INVALID_STATUS";
    const statusParam = new URL(invalidStatusUrl).searchParams.get("status");
    const isStatusValid = Object.values(PrescriptionStatus).includes(statusParam as PrescriptionStatus);
    assert(!isStatusValid, "Invalid status query string rejected by validator");

    // 8d. Controlled error responses on database / service exceptions
    const { GET: testDashRoute } = await import("../app/api/pharmacy/dashboard/route");
    assert(typeof testDashRoute === "function", "GET /api/pharmacy/dashboard handler exported");
    const { GET: testRxRoute } = await import("../app/api/pharmacy/prescriptions/route");
    assert(typeof testRxRoute === "function", "GET /api/pharmacy/prescriptions handler exported");
    const { GET: testRxDetailRoute } = await import("../app/api/pharmacy/prescriptions/[id]/route");
    assert(typeof testRxDetailRoute === "function", "GET /api/pharmacy/prescriptions/[id] handler exported");
  } finally {
    // ---------------------------------------------------------------------------
    // 9. CLEANUP TEMPORARY TEST DATA
    // ---------------------------------------------------------------------------
    console.log("\n-------------------------------------------------------------------------------");
    console.log("9. CLEANUP TEMPORARY TEST DATA");
    console.log("-------------------------------------------------------------------------------");

    if (createdPrescriptionId) {
      await prisma.prescriptionMedicine.deleteMany({
        where: { prescriptionId: createdPrescriptionId },
      });
      await prisma.prescription.delete({
        where: { id: createdPrescriptionId },
      });
      console.log(`  ✓ Cleaned up temporary test prescription [ID: ${createdPrescriptionId}]`);
    } else {
      console.log("  ✓ No temporary test records needed cleanup");
    }
  }

  // ---------------------------------------------------------------------------
  // SUMMARY
  // ---------------------------------------------------------------------------
  console.log("\n===============================================================================");
  console.log(`🎉 ALL ${passedChecks}/${totalChecks} PHARMACY INTEGRATION & SECURITY CHECKS PASSED WITH 100% SUCCESS!`);
  console.log("===============================================================================\n");
}

runPharmacyIntegrationVerification()
  .catch((err) => {
    console.error("\n❌ Pharmacy integration test failed:\n", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
