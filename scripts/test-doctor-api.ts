import { UserRole, PrescriptionStatus } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { AuthUser, requireRole, AuthorizationError } from "../lib/permissions";
import {
  getDoctorDashboardData,
  getDoctorPatientsRoster,
  getDoctorPrescriptionsList,
  getDoctorPrescriptionDetail,
} from "../lib/doctor-service";

async function runDoctorApiTestSuite() {
  console.log("===============================================================================");
  console.log("🩺 MedEasy Prescription-to-Order Tracking System - Doctor API Verification");
  console.log("===============================================================================\n");

  // Retrieve seeded users
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

  const doctorSarahAuth: AuthUser = {
    id: doctorSarahDb.id,
    email: doctorSarahDb.email,
    role: UserRole.DOCTOR,
    name: "Dr. Sarah",
  };

  const doctorJohnAuth: AuthUser = {
    id: doctorJohnDb.id,
    email: doctorJohnDb.email,
    role: UserRole.DOCTOR,
    name: "Dr. John",
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

  // ---------------------------------------------------------------------------
  // 1. UNAUTHENTICATED REQUESTS REJECTION (HTTP 401)
  // ---------------------------------------------------------------------------
  console.log("-------------------------------------------------------------------------------");
  console.log("1. VERIFY 401 UNAUTHORIZED ON MISSING SESSION FOR DOCTOR ENDPOINTS");
  console.log("-------------------------------------------------------------------------------");

  const { GET: doctorDashboardHandler } = await import("../app/api/doctor/dashboard/route");
  const { GET: doctorPatientsHandler } = await import("../app/api/doctor/patients/route");
  const { GET: doctorPrescriptionsHandler } = await import("../app/api/doctor/prescriptions/route");
  const { GET: doctorPrescriptionDetailHandler } = await import("../app/api/doctor/prescriptions/[id]/route");

  const unauthDashboard = await doctorDashboardHandler();
  if (unauthDashboard.status !== 401) {
    throw new Error(`❌ Expected 401 from unauthenticated /api/doctor/dashboard, got ${unauthDashboard.status}`);
  }
  console.log("  ✓ GET /api/doctor/dashboard enforces 401 Unauthorized for unauthenticated requests");

  const unauthPatients = await doctorPatientsHandler();
  if (unauthPatients.status !== 401) {
    throw new Error(`❌ Expected 401 from unauthenticated /api/doctor/patients, got ${unauthPatients.status}`);
  }
  console.log("  ✓ GET /api/doctor/patients enforces 401 Unauthorized for unauthenticated requests");

  const unauthPrescriptions = await doctorPrescriptionsHandler();
  if (unauthPrescriptions.status !== 401) {
    throw new Error(`❌ Expected 401 from unauthenticated /api/doctor/prescriptions, got ${unauthPrescriptions.status}`);
  }
  console.log("  ✓ GET /api/doctor/prescriptions enforces 401 Unauthorized for unauthenticated requests");

  const unauthDetail = await doctorPrescriptionDetailHandler(
    new Request("http://localhost:3000/api/doctor/prescriptions/dummy-id"),
    { params: { id: "dummy-id" } }
  );
  if (unauthDetail.status !== 401) {
    throw new Error(`❌ Expected 401 from unauthenticated /api/doctor/prescriptions/[id], got ${unauthDetail.status}`);
  }
  console.log("  ✓ GET /api/doctor/prescriptions/[id] enforces 401 Unauthorized for unauthenticated requests");

  // ---------------------------------------------------------------------------
  // 2. ROLE-BASED ACCESS CONTROL (HTTP 403 FORBIDDEN FOR NON-DOCTORS)
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
      throw new Error(`❌ requireRole(DOCTOR) failed to reject ${nonDoc.label} user with 403!`);
    }
    console.log(`  ✓ ${nonDoc.label.padEnd(8)} correctly rejected with HTTP 403 Forbidden from Doctor resources`);
  }

  // ---------------------------------------------------------------------------
  // 3. DOCTOR DASHBOARD LIVE DB COMPUTATIONS & ACCURACY
  // ---------------------------------------------------------------------------
  console.log("\n-------------------------------------------------------------------------------");
  console.log("3. VERIFY DOCTOR DASHBOARD LIVE DB CALCULATIONS (No hardcoded values)");
  console.log("-------------------------------------------------------------------------------");

  const doctorSarahProfileId = doctorSarahDb.doctorProfile!.id;

  // Expected counts from DB for Dr. Sarah
  const [expectedSarahTotalRx, expectedSarahPendingRx, expectedSarahFilledRx, expectedSarahPatients] =
    await Promise.all([
      prisma.prescription.count({ where: { doctorId: doctorSarahProfileId } }),
      prisma.prescription.count({
        where: { doctorId: doctorSarahProfileId, status: PrescriptionStatus.PENDING },
      }),
      prisma.prescription.count({
        where: { doctorId: doctorSarahProfileId, status: PrescriptionStatus.FILLED },
      }),
      prisma.doctorPatient.count({ where: { doctorId: doctorSarahProfileId } }),
    ]);

  const sarahDashboard = await getDoctorDashboardData(doctorSarahDb.id);
  if ("error" in sarahDashboard) {
    throw new Error(`❌ getDoctorDashboardData failed for Dr. Sarah: ${sarahDashboard.error}`);
  }

  if (sarahDashboard.stats.totalPrescriptions !== expectedSarahTotalRx) {
    throw new Error(
      `❌ Dashboard totalPrescriptions mismatch: expected ${expectedSarahTotalRx}, got ${sarahDashboard.stats.totalPrescriptions}`
    );
  }

  if (sarahDashboard.stats.pendingCount !== expectedSarahPendingRx) {
    throw new Error(
      `❌ Dashboard pendingCount mismatch: expected ${expectedSarahPendingRx}, got ${sarahDashboard.stats.pendingCount}`
    );
  }

  if (sarahDashboard.stats.filledCount !== expectedSarahFilledRx) {
    throw new Error(
      `❌ Dashboard filledCount mismatch: expected ${expectedSarahFilledRx}, got ${sarahDashboard.stats.filledCount}`
    );
  }

  if (sarahDashboard.stats.totalPatients !== expectedSarahPatients) {
    throw new Error(
      `❌ Dashboard totalPatients mismatch: expected ${expectedSarahPatients}, got ${sarahDashboard.stats.totalPatients}`
    );
  }

  if (!Array.isArray(sarahDashboard.recentPrescriptions) || sarahDashboard.recentPrescriptions.length === 0) {
    throw new Error("❌ Dashboard recentPrescriptions is empty or not an array!");
  }

  // Ensure recent prescriptions strictly belong to Dr. Sarah
  for (const rx of sarahDashboard.recentPrescriptions) {
    if (rx.doctorId !== doctorSarahProfileId) {
      throw new Error(`❌ Cross-doctor data leak in recentPrescriptions: found rx with doctorId ${rx.doctorId}`);
    }
  }

  console.log(`  ✓ Dr. Sarah Dashboard:`);
  console.log(`    - Total Prescriptions : ${sarahDashboard.stats.totalPrescriptions}`);
  console.log(`    - Pending Count       : ${sarahDashboard.stats.pendingCount}`);
  console.log(`    - Filled Count        : ${sarahDashboard.stats.filledCount}`);
  console.log(`    - Total Roster Patients: ${sarahDashboard.stats.totalPatients}`);
  console.log(`    - Recent Prescriptions: ${sarahDashboard.recentPrescriptions.length} items loaded`);

  // ---------------------------------------------------------------------------
  // 4. DOCTOR PATIENT ROSTER ISOLATION (DoctorPatient Relationship)
  // ---------------------------------------------------------------------------
  console.log("\n-------------------------------------------------------------------------------");
  console.log("4. VERIFY PATIENT ROSTER ISOLATION ACROSS CLINICIANS");
  console.log("-------------------------------------------------------------------------------");

  const sarahRoster = await getDoctorPatientsRoster(doctorSarahDb.id);
  if ("error" in sarahRoster) throw new Error(`❌ Failed to get Sarah roster: ${sarahRoster.error}`);

  const johnRoster = await getDoctorPatientsRoster(doctorJohnDb.id);
  if ("error" in johnRoster) throw new Error(`❌ Failed to get John roster: ${johnRoster.error}`);

  const sarahPatientNames = sarahRoster.patients.map((p) => p.name);
  const johnPatientNames = johnRoster.patients.map((p) => p.name);

  console.log(`  ✓ Dr. Sarah Roster (${sarahPatientNames.length} patients): ${sarahPatientNames.join(", ")}`);
  console.log(`  ✓ Dr. John Roster  (${johnPatientNames.length} patients): ${johnPatientNames.join(", ")}`);

  // In seed data:
  // Dr. Sarah has: Alice, Robert, Clara, David
  // Dr. John has: Clara, David, Emma
  // Alice & Robert should NOT be in Dr. John's roster
  // Emma should NOT be in Dr. Sarah's roster
  if (johnPatientNames.includes("Alice Johnson") || johnPatientNames.includes("Robert Miller")) {
    throw new Error("❌ Cross-doctor roster violation: Dr. John sees Dr. Sarah's exclusive patients!");
  }

  if (sarahPatientNames.includes("Emma Watson")) {
    throw new Error("❌ Cross-doctor roster violation: Dr. Sarah sees Dr. John's exclusive patient Emma Watson!");
  }

  console.log("  ✓ DoctorPatient roster isolation strictly enforced: clinicians only see their assigned patients");

  // ---------------------------------------------------------------------------
  // 5. DOCTOR PRESCRIPTIONS LIST ISOLATION
  // ---------------------------------------------------------------------------
  console.log("\n-------------------------------------------------------------------------------");
  console.log("5. VERIFY PRESCRIPTIONS LIST ISOLATION");
  console.log("-------------------------------------------------------------------------------");

  const sarahPrescriptions = await getDoctorPrescriptionsList(doctorSarahDb.id);
  if ("error" in sarahPrescriptions) throw new Error(`❌ Failed to get Sarah prescriptions: ${sarahPrescriptions.error}`);

  const johnPrescriptions = await getDoctorPrescriptionsList(doctorJohnDb.id);
  if ("error" in johnPrescriptions) throw new Error(`❌ Failed to get John prescriptions: ${johnPrescriptions.error}`);

  for (const rx of sarahPrescriptions.prescriptions) {
    if (rx.doctorId !== doctorSarahProfileId) {
      throw new Error(`❌ Doctor prescriptions list leaked another doctor's prescription! (Found ${rx.doctorId})`);
    }
  }

  for (const rx of johnPrescriptions.prescriptions) {
    if (rx.doctorId !== doctorJohnDb.doctorProfile!.id) {
      throw new Error(`❌ Doctor prescriptions list leaked another doctor's prescription! (Found ${rx.doctorId})`);
    }
  }

  console.log(`  ✓ Dr. Sarah has ${sarahPrescriptions.prescriptions.length} prescriptions authored exclusively by her`);
  console.log(`  ✓ Dr. John has ${johnPrescriptions.prescriptions.length} prescriptions authored exclusively by him`);

  // ---------------------------------------------------------------------------
  // 6. DOCTOR PRESCRIPTION DETAIL OWNERSHIP & SAFE ACCESS DENIAL
  // ---------------------------------------------------------------------------
  console.log("\n-------------------------------------------------------------------------------");
  console.log("6. VERIFY PRESCRIPTION DETAIL OWNERSHIP & 403 / 404 ERROR HANDLING");
  console.log("-------------------------------------------------------------------------------");

  const sarahRx = sarahPrescriptions.prescriptions[0];
  const johnRx = johnPrescriptions.prescriptions[0];

  // 6a. Authoring doctor accesses own prescription -> 200 OK with diagnosis
  const validDetailResult = await getDoctorPrescriptionDetail(doctorSarahDb.id, sarahRx.id);
  if ("error" in validDetailResult) {
    throw new Error(`❌ Failed to fetch prescription detail for authoring doctor: ${validDetailResult.error}`);
  }
  if (validDetailResult.prescription.diagnosis !== sarahRx.diagnosis) {
    throw new Error("❌ Diagnosis missing or mismatched in doctor prescription detail!");
  }
  console.log(`  ✓ Authoring doctor granted full access to prescription [ID: ${sarahRx.id}] including diagnosis ("${sarahRx.diagnosis}")`);

  // 6b. Cross-Doctor access attempt -> 403 Forbidden
  const crossDoctorResult = await getDoctorPrescriptionDetail(doctorSarahDb.id, johnRx.id);
  if (!("error" in crossDoctorResult) || crossDoctorResult.statusCode !== 403) {
    throw new Error(`❌ Expected 403 Forbidden when Dr. Sarah accesses Dr. John's prescription, got: ${JSON.stringify(crossDoctorResult)}`);
  }
  console.log(`  ✓ Cross-doctor unauthorized access blocked safely with HTTP 403 Forbidden: "${crossDoctorResult.error}"`);

  // 6c. Nonexistent prescription lookup -> 404 Not Found
  const nonexistentResult = await getDoctorPrescriptionDetail(doctorSarahDb.id, "nonexistent-rx-id-99999");
  if (!("error" in nonexistentResult) || nonexistentResult.statusCode !== 404) {
    throw new Error(`❌ Expected 404 Not Found for non-existent prescription, got: ${JSON.stringify(nonexistentResult)}`);
  }
  console.log(`  ✓ Non-existent prescription ID safely returned HTTP 404 Not Found: "${nonexistentResult.error}"`);

  // ---------------------------------------------------------------------------
  // 7. SENSITIVE DATA LEAKAGE PREVENTION
  // ---------------------------------------------------------------------------
  console.log("\n-------------------------------------------------------------------------------");
  console.log("7. VERIFY SECURITY SANITIZATION (No password hashes or leaked credentials)");
  console.log("-------------------------------------------------------------------------------");

  const stringifiedRoster = JSON.stringify(sarahRoster);
  const stringifiedRxList = JSON.stringify(sarahPrescriptions);
  const stringifiedDetail = JSON.stringify(validDetailResult);

  const sensitiveKeys = ["password", "passwordHash", "resetToken", "secret"];
  for (const key of sensitiveKeys) {
    if (stringifiedRoster.includes(`"${key}"`) || stringifiedRxList.includes(`"${key}"`) || stringifiedDetail.includes(`"${key}"`)) {
      throw new Error(`❌ CRITICAL SECURITY LEAK: Found sensitive key "${key}" in Doctor API payload!`);
    }
  }
  console.log("  ✓ Verified: Zero sensitive fields (passwords, tokens, secrets) present in responses");

  console.log("\n===============================================================================");
  console.log("🎉 ALL DOCTOR API ENDPOINT & AUTHORIZATION TESTS PASSED WITH 100% SUCCESS!");
  console.log("===============================================================================");
}

runDoctorApiTestSuite()
  .catch((err) => {
    console.error("\n❌ Doctor API Test Suite Failed with Error:\n", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
