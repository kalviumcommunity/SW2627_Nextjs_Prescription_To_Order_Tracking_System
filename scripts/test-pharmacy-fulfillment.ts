import assert from "node:assert";
import { UserRole, PrescriptionStatus } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { AuthUser, requireRole, AuthorizationError } from "../lib/permissions";
import { fulfillPrescription } from "../lib/pharmacy-service";
import { PATCH as fulfillRouteHandler } from "../app/api/pharmacy/prescriptions/[id]/fulfill/route";

function assertDiagnosisAbsent(value: unknown, path: string = "root") {
  if (!value || typeof value !== "object") return;
  if (Object.prototype.hasOwnProperty.call(value, "diagnosis")) {
    throw new Error(`CRITICAL PRIVACY VIOLATION: diagnosis field leaked at path "${path}"`);
  }
  for (const [key, child] of Object.entries(value)) {
    assertDiagnosisAbsent(child, `${path}.${key}`);
  }
}

async function runPharmacyFulfillmentTestSuite() {
  console.log("===============================================================================");
  console.log("💊 MedEasy Day 12 - Pharmacy Prescription Fulfillment Verification Suite");
  console.log("===============================================================================\n");

  let totalChecks = 0;
  let passedChecks = 0;

  function testCheck(condition: boolean, message: string) {
    totalChecks++;
    if (!condition) {
      console.error(`  ❌ FAIL: ${message}`);
      throw new Error(`Assertion failed: ${message}`);
    } else {
      passedChecks++;
      console.log(`  ✓ PASS: ${message}`);
    }
  }

  const trackedPrescriptionIds: string[] = [];

  try {
    // ---------------------------------------------------------------------------
    // 1. SETUP: LOAD SEED USERS & PROFILES
    // ---------------------------------------------------------------------------
    console.log("-------------------------------------------------------------------------------");
    console.log("1. RESOLVE SEED USERS & PROFILES");
    console.log("-------------------------------------------------------------------------------");

    const [pharmacyUser, doctorUser, patientUser, adminUser, medicine] = await Promise.all([
      prisma.user.findUniqueOrThrow({
        where: { email: "pharmacy@medeasy.demo" },
        include: { pharmacyProfile: true },
      }),
      prisma.user.findUniqueOrThrow({
        where: { email: "dr.sarah@medeasy.demo" },
        include: { doctorProfile: true },
      }),
      prisma.user.findUniqueOrThrow({
        where: { email: "patient.alice@medeasy.demo" },
        include: { patientProfile: true },
      }),
      prisma.user.findUniqueOrThrow({
        where: { email: "admin@medeasy.demo" },
      }),
      prisma.medicine.findFirstOrThrow({
        where: { stockStatus: true },
      }),
    ]);

    testCheck(Boolean(pharmacyUser.pharmacyProfile), "Central Pharmacy has active PharmacyProfile");
    const pharmacyProfileId = pharmacyUser.pharmacyProfile!.id;

    const pharmacyAuth: AuthUser = {
      id: pharmacyUser.id,
      email: pharmacyUser.email,
      role: UserRole.PHARMACY,
      name: pharmacyUser.pharmacyProfile!.pharmacyName,
    };

    const doctorAuth: AuthUser = {
      id: doctorUser.id,
      email: doctorUser.email,
      role: UserRole.DOCTOR,
      name: "Dr. Sarah",
    };

    const patientAuth: AuthUser = {
      id: patientUser.id,
      email: patientUser.email,
      role: UserRole.PATIENT,
      name: "Alice Johnson",
    };

    const adminAuth: AuthUser = {
      id: adminUser.id,
      email: adminUser.email,
      role: UserRole.ADMIN,
      name: "System Admin",
    };

    // Helper to create a dedicated pending prescription for testing
    const createTestPrescription = async (diagnosisLabel: string = "Acute Bacterial Sinusitis") => {
      const rx = await prisma.prescription.create({
        data: {
          doctorId: doctorUser.doctorProfile!.id,
          patientId: patientUser.patientProfile!.id,
          diagnosis: `CONFIDENTIAL MEDICAL DIAGNOSIS: ${diagnosisLabel}`,
          documentRef: "rx-docs/fulfillment-test.pdf",
          status: PrescriptionStatus.PENDING,
          prescriptionMedicines: {
            create: [
              {
                medicineId: medicine.id,
                dosage: "500mg",
                frequency: "Twice daily",
                duration: "5 days",
              },
            ],
          },
        },
      });
      trackedPrescriptionIds.push(rx.id);
      return rx;
    };

    // ---------------------------------------------------------------------------
    // 2. AUTHORIZATION TESTS: 401 UNAUTHENTICATED & 403 WRONG ROLE
    // ---------------------------------------------------------------------------
    console.log("\n-------------------------------------------------------------------------------");
    console.log("2. AUTHORIZATION GUARDS (401 UNAUTHENTICATED & 403 FORBIDDEN)");
    console.log("-------------------------------------------------------------------------------");

    const authTestRx = await createTestPrescription("Auth Test Prescription");

    // 2a. Unauthenticated PATCH call -> HTTP 401
    const unauthReq = new Request(
      `http://localhost:3000/api/pharmacy/prescriptions/${authTestRx.id}/fulfill`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "FILLED" }),
      }
    );
    const unauthRes = await fulfillRouteHandler(unauthReq, { params: { id: authTestRx.id } });
    testCheck(unauthRes.status === 401, "Unauthenticated PATCH request rejected with HTTP 401 Unauthorized");

    // 2b. Non-pharmacy roles rejected with HTTP 403 Forbidden
    const wrongRoles: { role: string; auth: AuthUser }[] = [
      { role: "DOCTOR", auth: doctorAuth },
      { role: "PATIENT", auth: patientAuth },
      { role: "ADMIN", auth: adminAuth },
    ];

    for (const wrong of wrongRoles) {
      let rejected403 = false;
      try {
        await requireRole(UserRole.PHARMACY, wrong.auth);
      } catch (err) {
        if (err instanceof AuthorizationError && err.statusCode === 403) {
          rejected403 = true;
        }
      }
      testCheck(rejected403, `requireRole(PHARMACY) rejects ${wrong.role} with HTTP 403 Forbidden`);

      const wrongReq = new Request(
        `http://localhost:3000/api/pharmacy/prescriptions/${authTestRx.id}/fulfill`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "FILLED" }),
        }
      );
      const routeWrongRes = await fulfillRouteHandler(
        wrongReq,
        { params: { id: authTestRx.id } },
        { userOverride: wrong.auth }
      );
      testCheck(
        routeWrongRes.status === 403,
        `Route handler rejected ${wrong.role} with HTTP 403 Forbidden`
      );
    }

    // ---------------------------------------------------------------------------
    // 3. INPUT VALIDATION & NOT FOUND CHECKS (400 BAD REQUEST & 404 NOT FOUND)
    // ---------------------------------------------------------------------------
    console.log("\n-------------------------------------------------------------------------------");
    console.log("3. INPUT VALIDATION & RESOURCE EXISTENCE (400 & 404)");
    console.log("-------------------------------------------------------------------------------");

    // 3a. Non-existent prescription -> 404 Not Found
    const missingRxResult = await fulfillPrescription(pharmacyAuth.id, "cmtnonexistentcuid00000000000", {
      action: "FILLED",
    });
    testCheck(
      "error" in missingRxResult && missingRxResult.statusCode === 404,
      "Fulfillment on non-existent prescription returns HTTP 404 Not Found"
    );

    // Route handler check for 404
    const missingRouteReq = new Request(
      "http://localhost:3000/api/pharmacy/prescriptions/cmtnonexistentcuid00000000000/fulfill",
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "FILLED" }),
      }
    );
    const missingRouteRes = await fulfillRouteHandler(
      missingRouteReq,
      { params: { id: "cmtnonexistentcuid00000000000" } },
      { userOverride: pharmacyAuth }
    );
    testCheck(missingRouteRes.status === 404, "Route handler returns HTTP 404 for missing prescription");

    // 3b. Invalid actions -> 400 Bad Request
    const invalidActions = ["INVALID", "PENDING", "COMPLETED", "", 123 as unknown as string];
    for (const badAction of invalidActions) {
      const badResult = await fulfillPrescription(pharmacyAuth.id, authTestRx.id, {
        action: badAction,
      });
      testCheck(
        "error" in badResult && badResult.statusCode === 400,
        `Invalid action "${badAction}" rejected with HTTP 400 Bad Request`
      );
    }

    // 3c. Empty / non-JSON request body -> 400 Bad Request
    const emptyBodyReq = new Request(
      `http://localhost:3000/api/pharmacy/prescriptions/${authTestRx.id}/fulfill`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: "invalid-not-json",
      }
    );
    const emptyBodyRes = await fulfillRouteHandler(
      emptyBodyReq,
      { params: { id: authTestRx.id } },
      { userOverride: pharmacyAuth }
    );
    testCheck(emptyBodyRes.status === 400, "Non-JSON request body rejected with HTTP 400 Bad Request");

    // ---------------------------------------------------------------------------
    // 4. VALID FULFILLMENT: ACTION "FILLED"
    // ---------------------------------------------------------------------------
    console.log("\n-------------------------------------------------------------------------------");
    console.log("4. VALID FULFILLMENT: ACTION 'FILLED' LIFECYCLE");
    console.log("-------------------------------------------------------------------------------");

    const filledRx = await createTestPrescription("Filled Scenario Prescription");

    const fillNotes = "Dispensed 1 pack 500mg. Verified batch #BX-9021.";
    const fillResult = await fulfillPrescription(pharmacyAuth.id, filledRx.id, {
      action: "FILLED",
      notes: fillNotes,
    });

    testCheck(!("error" in fillResult), "fulfillPrescription(FILLED) succeeded without error");
    if (!("error" in fillResult)) {
      testCheck(fillResult.success === true, "Response indicates success: true");
      testCheck(fillResult.prescription.status === PrescriptionStatus.FILLED, "Response prescription status is FILLED");
      testCheck(Boolean(fillResult.prescription.filledAt), "Response includes non-null filledAt timestamp");
      testCheck(fillResult.prescription.fill !== null, "Response includes fill detail");
      testCheck(
        fillResult.prescription.fill?.pharmacy?.id === pharmacyProfileId,
        "Response fill identifies the authenticated pharmacy"
      );
      testCheck(fillResult.prescription.fill?.notes === fillNotes, "Response fill includes supplied fulfillment notes");

      // Privacy assertion
      assertDiagnosisAbsent(fillResult, "FulfillPrescriptionResult");
      testCheck(true, "Diagnosis is strictly redacted and absent from FILLED response");
    }

    // Database manual verification
    const dbPrescriptionAfterFill = await prisma.prescription.findUniqueOrThrow({
      where: { id: filledRx.id },
      include: { fill: true },
    });
    testCheck(dbPrescriptionAfterFill.status === PrescriptionStatus.FILLED, "Database confirms prescription status is FILLED");
    testCheck(Boolean(dbPrescriptionAfterFill.filledAt), "Database confirms filledAt timestamp recorded on Prescription");

    const fillRecordsCount = await prisma.fill.count({
      where: { prescriptionId: filledRx.id },
    });
    testCheck(fillRecordsCount === 1, "Database confirms EXACTLY ONE Fill record created for prescription");

    const fillRecord = await prisma.fill.findUniqueOrThrow({
      where: { prescriptionId: filledRx.id },
    });
    testCheck(fillRecord.pharmacyId === pharmacyProfileId, "Fill record pharmacyId strictly matches authenticated session profile");
    testCheck(Boolean(fillRecord.filledAt), "Fill record filledAt timestamp is populated");
    testCheck(fillRecord.notes === fillNotes, "Fill record notes match submitted text");

    // ---------------------------------------------------------------------------
    // 5. DUPLICATE PROTECTION & TERMINAL STATE: ALREADY FILLED
    // ---------------------------------------------------------------------------
    console.log("\n-------------------------------------------------------------------------------");
    console.log("5. TERMINAL STATE ENFORCEMENT: ALREADY FILLED (HTTP 409 CONFLICT)");
    console.log("-------------------------------------------------------------------------------");

    // Attempting to re-fill an already FILLED prescription -> 409
    const refillAttempt = await fulfillPrescription(pharmacyAuth.id, filledRx.id, {
      action: "FILLED",
    });
    testCheck(
      "error" in refillAttempt && refillAttempt.statusCode === 409,
      "Second fill attempt on already FILLED prescription returns HTTP 409 Conflict"
    );

    // Attempting CANNOT_FILL on already FILLED prescription -> 409
    const cannotFillOnFilledAttempt = await fulfillPrescription(pharmacyAuth.id, filledRx.id, {
      action: "CANNOT_FILL",
    });
    testCheck(
      "error" in cannotFillOnFilledAttempt && cannotFillOnFilledAttempt.statusCode === 409,
      "Cannot-fill transition attempt on already FILLED prescription returns HTTP 409 Conflict"
    );

    // Route handler check for already FILLED
    const duplicateRouteReq = new Request(
      `http://localhost:3000/api/pharmacy/prescriptions/${filledRx.id}/fulfill`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "FILLED" }),
      }
    );
    const duplicateRouteRes = await fulfillRouteHandler(
      duplicateRouteReq,
      { params: { id: filledRx.id } },
      { userOverride: pharmacyAuth }
    );
    testCheck(duplicateRouteRes.status === 409, "Route handler returns HTTP 409 Conflict for already FILLED prescription");

    // Ensure fill record count did not increase
    const postConflictFillCount = await prisma.fill.count({
      where: { prescriptionId: filledRx.id },
    });
    testCheck(postConflictFillCount === 1, "Database still contains exactly ONE Fill row after conflict attempts");

    // ---------------------------------------------------------------------------
    // 6. VALID FULFILLMENT: ACTION "CANNOT_FILL"
    // ---------------------------------------------------------------------------
    console.log("\n-------------------------------------------------------------------------------");
    console.log("6. VALID FULFILLMENT: ACTION 'CANNOT_FILL' LIFECYCLE");
    console.log("-------------------------------------------------------------------------------");

    const cannotFillRx = await createTestPrescription("Cannot Fill Scenario Prescription");

    const cannotFillResult = await fulfillPrescription(pharmacyAuth.id, cannotFillRx.id, {
      action: "CANNOT_FILL",
    });

    testCheck(!("error" in cannotFillResult), "fulfillPrescription(CANNOT_FILL) succeeded without error");
    if (!("error" in cannotFillResult)) {
      testCheck(cannotFillResult.success === true, "Response indicates success: true");
      testCheck(
        cannotFillResult.prescription.status === PrescriptionStatus.CANNOT_FILL,
        "Response prescription status is CANNOT_FILL"
      );
      testCheck(cannotFillResult.prescription.fill === null, "Response fill is null for CANNOT_FILL");

      // Privacy assertion
      assertDiagnosisAbsent(cannotFillResult, "CannotFillResult");
      testCheck(true, "Diagnosis is strictly redacted and absent from CANNOT_FILL response");
    }

    // Database manual verification
    const dbPrescriptionAfterCannotFill = await prisma.prescription.findUniqueOrThrow({
      where: { id: cannotFillRx.id },
      include: { fill: true },
    });
    testCheck(
      dbPrescriptionAfterCannotFill.status === PrescriptionStatus.CANNOT_FILL,
      "Database confirms prescription status is CANNOT_FILL"
    );

    const cannotFillFillsCount = await prisma.fill.count({
      where: { prescriptionId: cannotFillRx.id },
    });
    testCheck(
      cannotFillFillsCount === 0,
      "Database confirms EXACTLY ZERO Fill records created for CANNOT_FILL outcome"
    );

    // ---------------------------------------------------------------------------
    // 7. TERMINAL STATE ENFORCEMENT: ALREADY CANNOT_FILL
    // ---------------------------------------------------------------------------
    console.log("\n-------------------------------------------------------------------------------");
    console.log("7. TERMINAL STATE ENFORCEMENT: ALREADY CANNOT_FILL (HTTP 409 CONFLICT)");
    console.log("-------------------------------------------------------------------------------");

    // Attempting CANNOT_FILL again -> 409
    const repeatCannotFillAttempt = await fulfillPrescription(pharmacyAuth.id, cannotFillRx.id, {
      action: "CANNOT_FILL",
    });
    testCheck(
      "error" in repeatCannotFillAttempt && repeatCannotFillAttempt.statusCode === 409,
      "Subsequent CANNOT_FILL attempt on terminal CANNOT_FILL returns HTTP 409 Conflict"
    );

    // Attempting FILLED on already CANNOT_FILL -> 409
    const fillOnCannotFillAttempt = await fulfillPrescription(pharmacyAuth.id, cannotFillRx.id, {
      action: "FILLED",
    });
    testCheck(
      "error" in fillOnCannotFillAttempt && fillOnCannotFillAttempt.statusCode === 409,
      "FILLED attempt on already CANNOT_FILL prescription returns HTTP 409 Conflict"
    );

    // Ensure database still has 0 fill records
    const postCannotFillCount = await prisma.fill.count({
      where: { prescriptionId: cannotFillRx.id },
    });
    testCheck(postCannotFillCount === 0, "Database still contains ZERO Fill rows after duplicate attempts on CANNOT_FILL");

    // ---------------------------------------------------------------------------
    // 8. UNTRUSTED CLIENT PHARMACY ID SPOOFING PROTECTION
    // ---------------------------------------------------------------------------
    console.log("\n-------------------------------------------------------------------------------");
    console.log("8. UNTRUSTED CLIENT PHARMACY ID SPOOFING PROTECTION");
    console.log("-------------------------------------------------------------------------------");

    const spoofTestRx = await createTestPrescription("Spoofing Test Prescription");
    const fakePharmacyId = "untrusted-spoofed-attacker-pharmacy-id";

    const spoofRouteReq = new Request(
      `http://localhost:3000/api/pharmacy/prescriptions/${spoofTestRx.id}/fulfill`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "FILLED",
          pharmacyId: fakePharmacyId, // Client spoofing attempt
          notes: "Client attempted to spoof pharmacyId",
        }),
      }
    );

    const spoofRouteRes = await fulfillRouteHandler(
      spoofRouteReq,
      { params: { id: spoofTestRx.id } },
      { userOverride: pharmacyAuth }
    );
    testCheck(spoofRouteRes.status === 200, "Route handler processed request successfully");

    const spoofDbFill = await prisma.fill.findUniqueOrThrow({
      where: { prescriptionId: spoofTestRx.id },
    });
    testCheck(
      spoofDbFill.pharmacyId === pharmacyProfileId,
      "Fill.pharmacyId strictly matched authenticated session and IGNORED client-supplied pharmacyId"
    );
    testCheck(
      spoofDbFill.pharmacyId !== fakePharmacyId,
      "Spoofed pharmacyId was completely disregarded"
    );

    // ---------------------------------------------------------------------------
    // 9. CONCURRENT FULFILLMENT ATTEMPTS / RACE CONDITION DUPLICATE PROTECTION
    // ---------------------------------------------------------------------------
    console.log("\n-------------------------------------------------------------------------------");
    console.log("9. CONCURRENCY & RACE CONDITION DUPLICATE PROTECTION");
    console.log("-------------------------------------------------------------------------------");

    const concurrentRx = await createTestPrescription("Concurrent Race Condition Test");

    // Dispatch 5 parallel fulfillment calls simultaneously on the same prescription
    const concurrencyPromises = Array.from({ length: 5 }).map((_, index) =>
      fulfillPrescription(pharmacyAuth.id, concurrentRx.id, {
        action: "FILLED",
        notes: `Concurrent race attempt #${index + 1}`,
      })
    );

    const concurrencyResults = await Promise.allSettled(concurrencyPromises);

    let successCount = 0;
    let conflictCount = 0;

    for (const result of concurrencyResults) {
      if (result.status === "fulfilled") {
        const val = result.value;
        if (!("error" in val) && val.success) {
          successCount++;
        } else if ("error" in val && val.statusCode === 409) {
          conflictCount++;
        }
      }
    }

    testCheck(successCount === 1, `Exactly ONE concurrent fulfillment succeeded (successCount: ${successCount})`);
    testCheck(conflictCount === 4, `Remaining 4 concurrent attempts failed with HTTP 409 Conflict (conflictCount: ${conflictCount})`);

    const concurrentDbFills = await prisma.fill.findMany({
      where: { prescriptionId: concurrentRx.id },
    });
    testCheck(concurrentDbFills.length === 1, "Database state guarantees EXACTLY ONE Fill record exists after race condition");

    const finalConcurrentRx = await prisma.prescription.findUniqueOrThrow({
      where: { id: concurrentRx.id },
    });
    testCheck(finalConcurrentRx.status === PrescriptionStatus.FILLED, "Prescription final state is FILLED");

    // ---------------------------------------------------------------------------
    // 10. PHARMACY DASHBOARD & QUEUE METRIC REFLECTION
    // ---------------------------------------------------------------------------
    console.log("\n-------------------------------------------------------------------------------");
    console.log("10. DASHBOARD & QUEUE METRIC REFLECTION AFTER FULFILLMENT");
    console.log("-------------------------------------------------------------------------------");

    const { getPharmacyDashboardData, getPharmacyPrescriptions } = await import("../lib/pharmacy-service");
    const dashboardAfter = await getPharmacyDashboardData(pharmacyAuth.id);
    testCheck(!("error" in dashboardAfter), "Dashboard retrieved successfully after fulfillments");
    if (!("error" in dashboardAfter)) {
      testCheck(dashboardAfter.metrics.todayFulfillmentCount >= 1, "metrics.todayFulfillmentCount reflects filled prescriptions");
      assertDiagnosisAbsent(dashboardAfter, "PostFulfillmentDashboard");
    }

    const filledQueue = await getPharmacyPrescriptions(pharmacyAuth.id, PrescriptionStatus.FILLED);
    testCheck(!("error" in filledQueue), "Filled queue retrieved successfully");
    if (!("error" in filledQueue)) {
      const foundFilled = filledQueue.prescriptions.some((rx) => rx.id === filledRx.id);
      testCheck(foundFilled, "Newly filled prescription appears in FILLED queue");
    }

    const pendingQueue = await getPharmacyPrescriptions(pharmacyAuth.id, PrescriptionStatus.PENDING);
    testCheck(!("error" in pendingQueue), "Pending queue retrieved successfully");
    if (!("error" in pendingQueue)) {
      const notInPending = !pendingQueue.prescriptions.some((rx) => rx.id === filledRx.id || rx.id === cannotFillRx.id);
      testCheck(notInPending, "Terminal prescriptions (FILLED / CANNOT_FILL) no longer appear in PENDING queue");
    }
  } finally {
    // ---------------------------------------------------------------------------
    // 11. CLEANUP ALL TEMPORARY TEST DATA
    // ---------------------------------------------------------------------------
    console.log("\n-------------------------------------------------------------------------------");
    console.log("11. CLEANUP TEMPORARY TEST DATA");
    console.log("-------------------------------------------------------------------------------");

    if (trackedPrescriptionIds.length > 0) {
      await prisma.fill.deleteMany({
        where: { prescriptionId: { in: trackedPrescriptionIds } },
      });
      await prisma.prescriptionMedicine.deleteMany({
        where: { prescriptionId: { in: trackedPrescriptionIds } },
      });
      const deleteResult = await prisma.prescription.deleteMany({
        where: { id: { in: trackedPrescriptionIds } },
      });
      console.log(`  ✓ Cleaned up ${deleteResult.count} temporary test prescriptions and related fills/medicines`);
    }
  }

  // ---------------------------------------------------------------------------
  // SUMMARY
  // ---------------------------------------------------------------------------
  console.log("\n===============================================================================");
  console.log(`🎉 ALL ${passedChecks}/${totalChecks} PHARMACY FULFILLMENT CHECKS PASSED WITH 100% SUCCESS!`);
  console.log("===============================================================================\n");
}

runPharmacyFulfillmentTestSuite()
  .catch((err) => {
    console.error("\n❌ Pharmacy fulfillment test suite failed:\n", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
