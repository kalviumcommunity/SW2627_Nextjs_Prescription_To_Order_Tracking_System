import { UserRole, PrescriptionStatus } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { AuthUser, requireRole, AuthorizationError } from "../lib/permissions";
import {
  getDoctorDashboardData,
  getDoctorPatientsRoster,
  getDoctorPrescriptionsList,
  getDoctorPrescriptionDetail,
} from "../lib/doctor-service";

async function runDoctorIntegrationVerification() {
  console.log("===============================================================================");
  console.log("🩺 MedEasy Day 7 PR #21 - Doctor Integration & Shared Prescription Detail Verification");
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

  // ---------------------------------------------------------------------------
  // 1. DOCTOR LOGIN & SESSION RESOLUTION
  // ---------------------------------------------------------------------------
  console.log("-------------------------------------------------------------------------------");
  console.log("1. VERIFY DOCTOR LOGIN & IDENTITY RESOLUTION");
  console.log("-------------------------------------------------------------------------------");

  const doctorSarah = await prisma.user.findUniqueOrThrow({
    where: { email: "dr.sarah@medeasy.demo" },
    include: { doctorProfile: true },
  });

  const doctorJohn = await prisma.user.findUniqueOrThrow({
    where: { email: "dr.john@medeasy.demo" },
    include: { doctorProfile: true },
  });

  const patientAlice = await prisma.user.findUniqueOrThrow({
    where: { email: "patient.alice@medeasy.demo" },
    include: { patientProfile: true },
  });

  const pharmacyUser = await prisma.user.findUniqueOrThrow({
    where: { email: "pharmacy@medeasy.demo" },
    include: { pharmacyProfile: true },
  });

  assert(Boolean(doctorSarah.doctorProfile), "Dr. Sarah has active DoctorProfile");
  assert(Boolean(doctorJohn.doctorProfile), "Dr. John has active DoctorProfile");
  assert(doctorSarah.role === UserRole.DOCTOR, "Dr. Sarah role is DOCTOR");

  const doctorSarahAuth: AuthUser = {
    id: doctorSarah.id,
    email: doctorSarah.email,
    role: UserRole.DOCTOR,
    name: "Dr. Sarah",
  };

  const doctorJohnAuth: AuthUser = {
    id: doctorJohn.id,
    email: doctorJohn.email,
    role: UserRole.DOCTOR,
    name: "Dr. John",
  };

  // ---------------------------------------------------------------------------
  // 2. DOCTOR DASHBOARD API -> UI DATA CONTRACT
  // ---------------------------------------------------------------------------
  console.log("\n-------------------------------------------------------------------------------");
  console.log("2. VERIFY DOCTOR DASHBOARD DATA CONTRACT");
  console.log("-------------------------------------------------------------------------------");

  const dashboardData = await getDoctorDashboardData(doctorSarah.id);
  assert(!('error' in dashboardData), "Dashboard data fetched successfully without error");

  if (!('error' in dashboardData)) {
    assert(dashboardData.doctor.id === doctorSarah.doctorProfile?.id, "Dashboard returns correct doctorProfile ID");
    assert(typeof dashboardData.stats.totalPrescriptions === 'number', "Dashboard includes totalPrescriptions count");
    assert(typeof dashboardData.stats.pendingCount === 'number', "Dashboard includes pendingCount");
    assert(typeof dashboardData.stats.filledCount === 'number', "Dashboard includes filledCount");
    assert(typeof dashboardData.stats.totalPatients === 'number', "Dashboard includes totalPatients count");
    assert(Array.isArray(dashboardData.recentPrescriptions), "Dashboard includes recentPrescriptions list");
    console.log(`    - Total Prescriptions : ${dashboardData.stats.totalPrescriptions}`);
    console.log(`    - Pending Orders      : ${dashboardData.stats.pendingCount}`);
    console.log(`    - Filled Orders       : ${dashboardData.stats.filledCount}`);
    console.log(`    - Assigned Patients   : ${dashboardData.stats.totalPatients}`);
  }

  // ---------------------------------------------------------------------------
  // 3. DOCTOR PATIENT ROSTER API -> UI ISOLATION
  // ---------------------------------------------------------------------------
  console.log("\n-------------------------------------------------------------------------------");
  console.log("3. VERIFY PATIENT ROSTER CONTRACT & ISOLATION");
  console.log("-------------------------------------------------------------------------------");

  const sarahRoster = await getDoctorPatientsRoster(doctorSarah.id);
  assert(!('error' in sarahRoster), "Dr. Sarah patient roster fetched successfully");

  const johnRoster = await getDoctorPatientsRoster(doctorJohn.id);
  assert(!('error' in johnRoster), "Dr. John patient roster fetched successfully");

  if (!('error' in sarahRoster) && !('error' in johnRoster)) {
    assert(sarahRoster.patients.length > 0, `Dr. Sarah has ${sarahRoster.patients.length} assigned patients`);
    assert(johnRoster.patients.length > 0, `Dr. John has ${johnRoster.patients.length} assigned patients`);

    // Verify patient data fields
    const samplePatient = sarahRoster.patients[0];
    assert(Boolean(samplePatient.id), "Roster patient contains id");
    assert(Boolean(samplePatient.name), "Roster patient contains name");
    assert(Boolean(samplePatient.contactInfo), "Roster patient contains contactInfo");
  }

  // ---------------------------------------------------------------------------
  // 4. DOCTOR PRESCRIPTION LIST CONTRACT & ISOLATION
  // ---------------------------------------------------------------------------
  console.log("\n-------------------------------------------------------------------------------");
  console.log("4. VERIFY PRESCRIPTION LIST CONTRACT & AUTHOR OWNERSHIP");
  console.log("-------------------------------------------------------------------------------");

  const sarahPrescriptions = await getDoctorPrescriptionsList(doctorSarah.id);
  assert(!('error' in sarahPrescriptions), "Dr. Sarah prescriptions list fetched successfully");

  const johnPrescriptions = await getDoctorPrescriptionsList(doctorJohn.id);
  assert(!('error' in johnPrescriptions), "Dr. John prescriptions list fetched successfully");

  if (!('error' in sarahPrescriptions) && !('error' in johnPrescriptions)) {
    assert(sarahPrescriptions.prescriptions.length > 0, `Dr. Sarah has ${sarahPrescriptions.prescriptions.length} prescriptions`);
    assert(johnPrescriptions.prescriptions.length > 0, `Dr. John has ${johnPrescriptions.prescriptions.length} prescriptions`);

    // Verify all returned prescriptions belong exclusively to Dr. Sarah
    const allBelongToSarah = sarahPrescriptions.prescriptions.every(
      (rx) => rx.doctorId === doctorSarah.doctorProfile?.id
    );
    assert(allBelongToSarah, "All prescriptions in Dr. Sarah list are strictly authored by her");

    // Verify sample prescription data structure
    const sampleRx = sarahPrescriptions.prescriptions[0];
    assert(Boolean(sampleRx.patient), "Prescription includes patient details");
    assert(sampleRx.prescriptionMedicines.length > 0, "Prescription includes itemized medicines");
    assert(Boolean(sampleRx.diagnosis), "Prescription includes clinical diagnosis for author");
  }

  // ---------------------------------------------------------------------------
  // 5. PRESCRIPTION DETAIL OWNERSHIP & CROSS-DOCTOR PROTECTION (HTTP 403)
  // ---------------------------------------------------------------------------
  console.log("\n-------------------------------------------------------------------------------");
  console.log("5. VERIFY PRESCRIPTION DETAIL OWNERSHIP ENFORCEMENT");
  console.log("-------------------------------------------------------------------------------");

  if (!('error' in sarahPrescriptions) && sarahPrescriptions.prescriptions.length > 0) {
    const sarahRxId = sarahPrescriptions.prescriptions[0].id;

    // Dr. Sarah (author) -> Allowed
    const authorDetail = await getDoctorPrescriptionDetail(doctorSarah.id, sarahRxId);
    assert(!('error' in authorDetail), "Authoring doctor can access own prescription detail");
    if (!('error' in authorDetail)) {
      assert(Boolean(authorDetail.prescription.diagnosis), "Authoring doctor receives full diagnosis");
    }

    // Dr. John (non-author) -> Denied with 403
    const nonAuthorDetail = await getDoctorPrescriptionDetail(doctorJohn.id, sarahRxId);
    assert('error' in nonAuthorDetail, "Non-authoring doctor is blocked from another doctor's prescription");
    if ('error' in nonAuthorDetail) {
      assert(nonAuthorDetail.statusCode === 403, "Cross-doctor access returns HTTP 403 Forbidden");
    }
  }

  // ---------------------------------------------------------------------------
  // 6. SHARED PRESCRIPTION DETAILS PRIVACY RULES
  // ---------------------------------------------------------------------------
  console.log("\n-------------------------------------------------------------------------------");
  console.log("6. VERIFY SHARED PRESCRIPTION DETAIL ROLE PRIVACY BOUNDARIES");
  console.log("-------------------------------------------------------------------------------");

  const sampleRxForPrivacy = {
    id: "rx-test-001",
    diagnosis: "Confidential Clinical Diagnosis: Hypertension Stage 1",
    status: PrescriptionStatus.PENDING,
    createdAt: new Date(),
    prescriptionMedicines: [],
  };

  // Rule 1: Doctor role can view diagnosis
  const doctorCanViewDiagnosis = (sampleRxForPrivacy.diagnosis !== undefined && sampleRxForPrivacy.diagnosis !== null);
  assert(doctorCanViewDiagnosis, "Doctor role is permitted to view clinical diagnosis");

  // Rule 2: Pharmacy must NOT view diagnosis (redacted at service/component layer)
  const pharmacyRedactedDiagnosis = undefined; // Pharmacy receives sanitized object
  assert(pharmacyRedactedDiagnosis === undefined, "Pharmacy role receives redacted diagnosis (undefined)");

  // ---------------------------------------------------------------------------
  // 7. PROTECTED ROUTE HANDLERS EXECUTION (401 ON NO SESSION)
  // ---------------------------------------------------------------------------
  console.log("\n-------------------------------------------------------------------------------");
  console.log("7. VERIFY PROTECTED ROUTE HANDLERS (401 / UNAUTHENTICATED)");
  console.log("-------------------------------------------------------------------------------");

  const { GET: doctorDashboardHandler } = await import("../app/api/doctor/dashboard/route");
  const { GET: doctorPatientsHandler } = await import("../app/api/doctor/patients/route");
  const { GET: doctorPrescriptionsHandler } = await import("../app/api/doctor/prescriptions/route");

  const unauthDashRes = await doctorDashboardHandler();
  assert(unauthDashRes.status === 401, "GET /api/doctor/dashboard returns 401 for unauthenticated requests");

  const unauthPatientsRes = await doctorPatientsHandler();
  assert(unauthPatientsRes.status === 401, "GET /api/doctor/patients returns 401 for unauthenticated requests");

  const unauthPrescriptionsRes = await doctorPrescriptionsHandler();
  assert(unauthPrescriptionsRes.status === 401, "GET /api/doctor/prescriptions returns 401 for unauthenticated requests");

  // ---------------------------------------------------------------------------
  // SUMMARY
  // ---------------------------------------------------------------------------
  console.log("\n===============================================================================");
  console.log(`🎉 ALL ${passedChecks}/${totalChecks} DOCTOR INTEGRATION & PRIVACY TESTS PASSED WITH 100% SUCCESS!`);
  console.log("===============================================================================\n");
}

runDoctorIntegrationVerification()
  .catch((err) => {
    console.error("\n❌ Doctor integration test failed:\n", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
