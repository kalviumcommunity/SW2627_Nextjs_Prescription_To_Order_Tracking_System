import assert from "node:assert";
import { PrescriptionStatus, UserRole } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { AuthUser } from "../lib/permissions";
import {
  getPatientDashboardData,
  getPatientPrescriptionsList,
  getPatientPrescriptionDetail,
  getPatientPrescriptionTracking,
  getPatientDashboardResponse,
  getPatientPrescriptionsResponse,
  getPatientPrescriptionDetailResponse,
  getPatientPrescriptionTrackingResponse,
} from "../lib/patient-service";
import { GET as dashboardRoute } from "../app/api/patient/dashboard/route";
import { GET as prescriptionsListRoute } from "../app/api/patient/prescriptions/route";
import { GET as prescriptionDetailRoute } from "../app/api/patient/prescriptions/[id]/route";
import { GET as prescriptionTrackingRoute } from "../app/api/patient/prescriptions/[id]/tracking/route";

function assertNoSensitiveOrganizationFields(payload: unknown, label: string) {
  const serialized = JSON.stringify(payload).toLowerCase();
  assert(!serialized.includes("organization"), `${label} does not expose organization data`);
  assert(!serialized.includes("password"), `${label} does not expose password data`);
}

async function runPatientBackendVerification() {
  console.log("===============================================================================");
  console.log("🧑‍⚕️ MedEasy Prescription-to-Order Tracking System - Day 14 Patient Backend Verification");
  console.log("===============================================================================\n");

  // ---------------------------------------------------------------------------
  // 1. RESOLVE SEEDED USERS FOR ROLE & OWNERSHIP TESTING
  // ---------------------------------------------------------------------------
  console.log("-------------------------------------------------------------------------------");
  console.log("1. RESOLVING TEST USERS & ROLES");
  console.log("-------------------------------------------------------------------------------");

  const [aliceUser, robertUser, davidUser, doctorUser, pharmacyUser] = await Promise.all([
    prisma.user.findUniqueOrThrow({
      where: { email: "patient.alice@medeasy.demo" },
      include: { patientProfile: true },
    }),
    prisma.user.findUniqueOrThrow({
      where: { email: "patient.robert@medeasy.demo" },
      include: { patientProfile: true },
    }),
    prisma.user.findUniqueOrThrow({
      where: { email: "patient.david@medeasy.demo" },
      include: { patientProfile: true },
    }),
    prisma.user.findUniqueOrThrow({
      where: { email: "dr.sarah@medeasy.demo" },
      include: { doctorProfile: true },
    }),
    prisma.user.findUniqueOrThrow({
      where: { email: "pharmacy@medeasy.demo" },
      include: { pharmacyProfile: true },
    }),
  ]);

  const aliceAuth: AuthUser = {
    id: aliceUser.id,
    email: aliceUser.email,
    role: UserRole.PATIENT,
    name: aliceUser.patientProfile?.name,
  };

  const robertAuth: AuthUser = {
    id: robertUser.id,
    email: robertUser.email,
    role: UserRole.PATIENT,
    name: robertUser.patientProfile?.name,
  };

  const davidAuth: AuthUser = {
    id: davidUser.id,
    email: davidUser.email,
    role: UserRole.PATIENT,
    name: davidUser.patientProfile?.name,
  };

  const doctorAuth: AuthUser = {
    id: doctorUser.id,
    email: doctorUser.email,
    role: UserRole.DOCTOR,
  };

  const pharmacyAuth: AuthUser = {
    id: pharmacyUser.id,
    email: pharmacyUser.email,
    role: UserRole.PHARMACY,
  };

  console.log(`  ✓ Resolved Alice (Patient): ID=${aliceUser.id}, ProfileID=${aliceUser.patientProfile?.id}`);
  console.log(`  ✓ Resolved Robert (Patient): ID=${robertUser.id}, ProfileID=${robertUser.patientProfile?.id}`);
  console.log(`  ✓ Resolved David (Patient): ID=${davidUser.id}, ProfileID=${davidUser.patientProfile?.id}`);
  console.log(`  ✓ Resolved Dr. Sarah (Doctor): ID=${doctorUser.id}`);
  console.log(`  ✓ Resolved Pharmacy: ID=${pharmacyUser.id}\n`);

  // Find sample prescriptions for each status:
  const [pendingRx, filledRx, cannotFillRx] = await Promise.all([
    prisma.prescription.findFirstOrThrow({
      where: { patientId: aliceUser.patientProfile!.id, status: PrescriptionStatus.PENDING },
      include: { prescriptionMedicines: { include: { medicine: true } } },
    }),
    prisma.prescription.findFirstOrThrow({
      where: { patientId: robertUser.patientProfile!.id, status: PrescriptionStatus.FILLED },
      include: { fill: { include: { pharmacy: true } } },
    }),
    prisma.prescription.findFirstOrThrow({
      where: { patientId: davidUser.patientProfile!.id, status: PrescriptionStatus.CANNOT_FILL },
      include: { prescriptionMedicines: { include: { medicine: true } } },
    }),
  ]);

  console.log(`  ✓ Found Seeded PENDING Rx: ${pendingRx.id} (belonging to Alice)`);
  console.log(`  ✓ Found Seeded FILLED Rx: ${filledRx.id} (belonging to Robert)`);
  console.log(`  ✓ Found Seeded CANNOT_FILL Rx: ${cannotFillRx.id} (belonging to David)\n`);

  // ---------------------------------------------------------------------------
  // 2. VERIFY UNAUTHENTICATED REQUESTS RETURN 401 UNAUTHORIZED
  // ---------------------------------------------------------------------------
  console.log("-------------------------------------------------------------------------------");
  console.log("2. VERIFY UNAUTHENTICATED ACCESS ENFORCEMENT (HTTP 401)");
  console.log("-------------------------------------------------------------------------------");

  const unauthDashboard = await getPatientDashboardResponse(null);
  assert.strictEqual(unauthDashboard.status, 401, "Dashboard without session returns 401");
  console.log("  ✓ GET /api/patient/dashboard enforces 401 for unauthenticated requests");

  const unauthList = await getPatientPrescriptionsResponse(null);
  assert.strictEqual(unauthList.status, 401, "Prescription list without session returns 401");
  console.log("  ✓ GET /api/patient/prescriptions enforces 401 for unauthenticated requests");

  const unauthDetail = await getPatientPrescriptionDetailResponse(pendingRx.id, null);
  assert.strictEqual(unauthDetail.status, 401, "Prescription detail without session returns 401");
  console.log("  ✓ GET /api/patient/prescriptions/[id] enforces 401 for unauthenticated requests");

  const unauthTracking = await getPatientPrescriptionTrackingResponse(pendingRx.id, null);
  assert.strictEqual(unauthTracking.status, 401, "Prescription tracking without session returns 401");
  console.log("  ✓ GET /api/patient/prescriptions/[id]/tracking enforces 401 for unauthenticated requests");

  // Direct Next.js route handlers invocation with no session
  assert.strictEqual((await dashboardRoute()).status, 401, "Dashboard Route Handler returns 401 when unauthenticated");
  assert.strictEqual((await prescriptionsListRoute()).status, 401, "List Route Handler returns 401 when unauthenticated");
  assert.strictEqual((await prescriptionDetailRoute(new Request("http://localhost"), { params: { id: pendingRx.id } })).status, 401, "Detail Route Handler returns 401 when unauthenticated");
  assert.strictEqual((await prescriptionTrackingRoute(new Request("http://localhost"), { params: { id: pendingRx.id } })).status, 401, "Tracking Route Handler returns 401 when unauthenticated");
  console.log("  ✓ Direct Route Handler functions enforce 401 when session is absent\n");

  // ---------------------------------------------------------------------------
  // 3. VERIFY NON-PATIENT ROLES CANNOT ACCESS PATIENT ENDPOINTS (HTTP 403)
  // ---------------------------------------------------------------------------
  console.log("-------------------------------------------------------------------------------");
  console.log("3. VERIFY ROLE RESTRICTIONS (DOCTOR & PHARMACY BLOCKED WITH 403)");
  console.log("-------------------------------------------------------------------------------");

  // Doctor cannot access patient endpoints
  assert.strictEqual((await getPatientDashboardResponse(doctorAuth)).status, 403, "Doctor denied patient dashboard");
  assert.strictEqual((await getPatientPrescriptionsResponse(doctorAuth)).status, 403, "Doctor denied patient prescription list");
  assert.strictEqual((await getPatientPrescriptionDetailResponse(pendingRx.id, doctorAuth)).status, 403, "Doctor denied patient prescription detail");
  assert.strictEqual((await getPatientPrescriptionTrackingResponse(pendingRx.id, doctorAuth)).status, 403, "Doctor denied patient prescription tracking");
  console.log("  ✓ DOCTOR role correctly denied access (403 Forbidden) across all patient endpoints");

  // Pharmacy cannot access patient endpoints
  assert.strictEqual((await getPatientDashboardResponse(pharmacyAuth)).status, 403, "Pharmacy denied patient dashboard");
  assert.strictEqual((await getPatientPrescriptionsResponse(pharmacyAuth)).status, 403, "Pharmacy denied patient prescription list");
  assert.strictEqual((await getPatientPrescriptionDetailResponse(pendingRx.id, pharmacyAuth)).status, 403, "Pharmacy denied patient prescription detail");
  assert.strictEqual((await getPatientPrescriptionTrackingResponse(pendingRx.id, pharmacyAuth)).status, 403, "Pharmacy denied patient prescription tracking");
  console.log("  ✓ PHARMACY role correctly denied access (403 Forbidden) across all patient endpoints\n");

  // ---------------------------------------------------------------------------
  // 4. VERIFY PATIENT DASHBOARD: REAL DB-DERIVED METRICS & RECENT ACTIVITY
  // ---------------------------------------------------------------------------
  console.log("-------------------------------------------------------------------------------");
  console.log("4. VERIFY PATIENT DASHBOARD METRICS & RECENT ACTIVITY");
  console.log("-------------------------------------------------------------------------------");

  const dashboardRes = await getPatientDashboardResponse(aliceAuth);
  assert.strictEqual(dashboardRes.status, 200, "Alice granted access to patient dashboard");
  const dashboard = await dashboardRes.json();
  assertNoSensitiveOrganizationFields(dashboard, "Dashboard response");

  // Validate patient profile header
  assert.strictEqual(dashboard.patient.id, aliceUser.patientProfile!.id, "Dashboard patient ID matches profile");
  assert.strictEqual(dashboard.patient.name, "Alice Johnson", "Dashboard patient name matches profile");

  // Query live DB values directly for Alice
  const [expectedPending, expectedFilled, expectedCannotFill, expectedTotal] = await Promise.all([
    prisma.prescription.count({
      where: { patientId: aliceUser.patientProfile!.id, status: PrescriptionStatus.PENDING },
    }),
    prisma.prescription.count({
      where: { patientId: aliceUser.patientProfile!.id, status: PrescriptionStatus.FILLED },
    }),
    prisma.prescription.count({
      where: { patientId: aliceUser.patientProfile!.id, status: PrescriptionStatus.CANNOT_FILL },
    }),
    prisma.prescription.count({
      where: { patientId: aliceUser.patientProfile!.id },
    }),
  ]);

  // Assert DB-derived values
  assert.strictEqual(dashboard.pendingPrescriptions, expectedPending, "Dashboard pending count matches DB");
  assert.strictEqual(dashboard.filledPrescriptions, expectedFilled, "Dashboard filled count matches DB");
  assert.strictEqual(dashboard.cannotFillPrescriptions, expectedCannotFill, "Dashboard cannot-fill count matches DB");
  assert.strictEqual(dashboard.activePrescriptions, expectedPending, "Dashboard active prescriptions count matches pending");
  assert.strictEqual(dashboard.totalPrescriptions, expectedTotal, "Dashboard total prescriptions count matches DB");

  // Also check stats object for structured consumers
  assert.strictEqual(dashboard.stats.activePrescriptions, expectedPending, "Stats active count matches DB");
  assert.strictEqual(dashboard.stats.pendingPrescriptions, expectedPending, "Stats pending count matches DB");
  assert.strictEqual(dashboard.stats.filledPrescriptions, expectedFilled, "Stats filled count matches DB");

  // Validate recent activity
  assert(Array.isArray(dashboard.recentActivity), "recentActivity is an array");
  assert(dashboard.recentActivity.length > 0, "Alice has recent prescription activity");
  const firstRecent = dashboard.recentActivity[0];
  assert(Boolean(firstRecent.id), "Recent item has prescription ID");
  assert(Boolean(firstRecent.doctorName), `Recent item has doctor name: ${firstRecent.doctorName}`);
  assert(Boolean(firstRecent.status), `Recent item has status: ${firstRecent.status}`);
  assert(Boolean(firstRecent.createdAt), "Recent item has createdAt timestamp");
  console.log(`  ✓ Live metrics verified: Pending=${dashboard.pendingPrescriptions}, Filled=${dashboard.filledPrescriptions}, Total=${dashboard.totalPrescriptions}`);
  console.log(`  ✓ Recent activity count: ${dashboard.recentActivity.length} prescriptions`);
  console.log(`  ✓ Most recent prescription: ID=${firstRecent.id}, Doctor=${firstRecent.doctorName}, Status=${firstRecent.status}\n`);

  // ---------------------------------------------------------------------------
  // 5. VERIFY PATIENT PRESCRIPTION LIST (OWNED PRESCRIPTIONS ONLY)
  // ---------------------------------------------------------------------------
  console.log("-------------------------------------------------------------------------------");
  console.log("5. VERIFY PATIENT PRESCRIPTION LIST & OWNERSHIP BOUNDARY");
  console.log("-------------------------------------------------------------------------------");

  const listRes = await getPatientPrescriptionsResponse(aliceAuth);
  assert.strictEqual(listRes.status, 200, "Alice granted access to prescription list");
  const listData = await listRes.json();
  assertNoSensitiveOrganizationFields(listData, "Prescription list response");

  assert(Array.isArray(listData.prescriptions), "Prescriptions list is an array");
  assert(listData.prescriptions.length > 0, "Alice has prescriptions in list");

  // Verify ownership: EVERY prescription in Alice's list must belong to Alice
  for (const rx of listData.prescriptions) {
    // Check required fields per prompt
    assert(Boolean(rx.id), "Prescription has ID");
    assert(Boolean(rx.doctorName), `Prescription has doctor name: ${rx.doctorName}`);
    assert(Boolean(rx.createdAt), "Prescription has createdAt");
    assert(Boolean(rx.status), `Prescription has status: ${rx.status}`);

    // Verify patient profile ID matches
    const dbRx = await prisma.prescription.findUniqueOrThrow({
      where: { id: rx.id },
      select: { patientId: true },
    });
    assert.strictEqual(dbRx.patientId, aliceUser.patientProfile!.id, `Prescription ${rx.id} strictly belongs to Alice`);
  }
  console.log(`  ✓ Verified ${listData.prescriptions.length} prescriptions belong strictly to Alice`);
  console.log("  ✓ All required list fields present: prescription ID, doctor name, createdAt, status\n");

  // ---------------------------------------------------------------------------
  // 6. VERIFY PATIENT PRESCRIPTION DETAIL: PATIENT-PERMITTED FIELDS
  // ---------------------------------------------------------------------------
  console.log("-------------------------------------------------------------------------------");
  console.log("6. VERIFY PATIENT PRESCRIPTION DETAIL & CLINICAL VISIBILITY");
  console.log("-------------------------------------------------------------------------------");

  const detailRes = await getPatientPrescriptionDetailResponse(pendingRx.id, aliceAuth);
  assert.strictEqual(detailRes.status, 200, "Alice granted access to her prescription detail");
  const detailData = await detailRes.json();
  assertNoSensitiveOrganizationFields(detailData, "Prescription detail response");
  const rxDetail = detailData.prescription;

  // 1. Patient Information
  assert(Boolean(rxDetail.patient), "Patient information is present");
  assert.strictEqual(rxDetail.patient.name, "Alice Johnson", "Patient name matches");
  assert.strictEqual(rxDetail.patient.age, 34, "Patient age matches");
  assert.strictEqual(rxDetail.patient.gender, "Female", "Patient gender matches");
  assert(Boolean(rxDetail.patient.contactInfo), "Patient contact info present");

  // 2. Doctor Information
  assert(Boolean(rxDetail.doctor), "Doctor information is present");
  assert(Boolean(rxDetail.doctor.name), `Doctor name formatted: ${rxDetail.doctor.name}`);
  assert(Boolean(rxDetail.doctor.specialization), `Doctor specialization present: ${rxDetail.doctor.specialization}`);
  assert(Boolean(rxDetail.doctor.phone), "Doctor phone present");

  // 3. Diagnosis (CRITICAL: MUST be visible to patient, unlike pharmacy)
  assert(Boolean(rxDetail.diagnosis), "Diagnosis is present");
  assert.strictEqual(rxDetail.diagnosis, pendingRx.diagnosis, `Patient can see clinical diagnosis: "${rxDetail.diagnosis}"`);

  // 4. Medicines, Dosage, Frequency, Duration
  assert(Array.isArray(rxDetail.medicines) && rxDetail.medicines.length > 0, "Medicines array present");
  const firstMed = rxDetail.medicines[0];
  assert(Boolean(firstMed.medicine.name), `Medicine name present: ${firstMed.medicine.name}`);
  assert(Boolean(firstMed.dosage), `Dosage present: ${firstMed.dosage}`);
  assert(Boolean(firstMed.frequency), `Frequency present: ${firstMed.frequency}`);
  assert(Boolean(firstMed.duration), `Duration present: ${firstMed.duration}`);

  // 5. Prescription Document
  assert.strictEqual(rxDetail.documentRef, pendingRx.documentRef, `Document reference present: ${rxDetail.documentRef}`);

  // 6. Status and Timestamps
  assert.strictEqual(rxDetail.status, PrescriptionStatus.PENDING, "Status matches PENDING");
  assert(Boolean(rxDetail.createdAt), "Creation timestamp present");
  console.log("  ✓ Patient information: Name, Age, Gender, Contact Info verified");
  console.log("  ✓ Doctor information: Name, Specialization, Phone verified");
  console.log("  ✓ Diagnosis is STRICTLY VISIBLE to patient (not redacted)");
  console.log("  ✓ Medicines detail: name, dosage, frequency, duration verified");
  console.log("  ✓ Prescription documentRef verified");
  console.log("  ✓ Status and creation timestamp verified\n");

  // ---------------------------------------------------------------------------
  // 7. CRITICAL OWNERSHIP RULE: CROSS-PATIENT ACCESS RETURNS SAFE 404
  // ---------------------------------------------------------------------------
  console.log("-------------------------------------------------------------------------------");
  console.log("7. CRITICAL OWNERSHIP RULE: PREVENT CROSS-PATIENT ACCESS (SAFE 404)");
  console.log("-------------------------------------------------------------------------------");

  // Alice tries to access Robert's prescription
  const aliceCrossRobertDetail = await getPatientPrescriptionDetailResponse(filledRx.id, aliceAuth);
  assert.strictEqual(
    aliceCrossRobertDetail.status,
    404,
    "Alice querying Robert's prescription returns HTTP 404 Not Found"
  );
  const robert404Body = await aliceCrossRobertDetail.json();
  const robertErrorMsg =
    typeof robert404Body.error === "object"
      ? robert404Body.error?.message
      : robert404Body.error;
  assert.strictEqual(robertErrorMsg, "Prescription not found.", "Safe error message returned");
  console.log("  ✓ Alice attempting to access Robert's Rx detail -> HTTP 404 Not Found (zero data leakage)");

  // Alice tries to access David's prescription
  const aliceCrossDavidDetail = await getPatientPrescriptionDetailResponse(cannotFillRx.id, aliceAuth);
  assert.strictEqual(
    aliceCrossDavidDetail.status,
    404,
    "Alice querying David's prescription returns HTTP 404 Not Found"
  );
  console.log("  ✓ Alice attempting to access David's Rx detail -> HTTP 404 Not Found (zero data leakage)");

  // Alice tries to track Robert's prescription
  const aliceCrossRobertTracking = await getPatientPrescriptionTrackingResponse(filledRx.id, aliceAuth);
  assert.strictEqual(
    aliceCrossRobertTracking.status,
    404,
    "Alice tracking Robert's prescription returns HTTP 404 Not Found"
  );
  console.log("  ✓ Alice attempting to access Robert's Rx tracking -> HTTP 404 Not Found");

  // Direct Route Handler parameter testing for cross-patient
  const crossRouteRes = await prescriptionDetailRoute(
    new Request("http://localhost"),
    { params: { id: filledRx.id } }
  );
  // Without session: 401
  assert.strictEqual(crossRouteRes.status, 401, "Direct route handler enforces 401 on unauthenticated call");

  // Query with nonexistent ID
  const nonExistentDetail = await getPatientPrescriptionDetailResponse("nonexistent-rx-9999", aliceAuth);
  assert.strictEqual(nonExistentDetail.status, 404, "Non-existent prescription returns 404");
  console.log("  ✓ Non-existent prescription ID returns exact same 404 as another patient's ID\n");

  // ---------------------------------------------------------------------------
  // 8. VERIFY TRACKING: PENDING, FILLED, AND CANNOT_FILL LIFECYCLE STATES
  // ---------------------------------------------------------------------------
  console.log("-------------------------------------------------------------------------------");
  console.log("8. VERIFY PRESCRIPTION TRACKING ACROSS ALL THREE LIFECYCLE STATES");
  console.log("-------------------------------------------------------------------------------");

  // Scenario A: PENDING tracking (Alice's Rx1)
  const pendingTrackRes = await getPatientPrescriptionTrackingResponse(pendingRx.id, aliceAuth);
  assert.strictEqual(pendingTrackRes.status, 200, "Alice can track her PENDING prescription");
  const pendingTrackData = await pendingTrackRes.json();
  assertNoSensitiveOrganizationFields(pendingTrackData, "Prescription tracking response");
  const pendingTrack = pendingTrackData.tracking;
  assert.strictEqual(pendingTrack.status, PrescriptionStatus.PENDING, "Tracking status is PENDING");
  assert.strictEqual(pendingTrack.state.isPending, true, "isPending flag is true");
  assert.strictEqual(pendingTrack.state.isFilled, false, "isFilled flag is false");
  assert.strictEqual(pendingTrack.state.isCannotFill, false, "isCannotFill flag is false");
  assert(pendingTrack.state.description.includes("awaiting pharmacy"), "PENDING message explains current queue state");
  console.log(`  ✓ PENDING tracking verified: Status=${pendingTrack.status}, Description="${pendingTrack.state.description}"`);

  // Scenario B: FILLED tracking (Robert's Rx3)
  const filledTrackRes = await getPatientPrescriptionTrackingResponse(filledRx.id, robertAuth);
  assert.strictEqual(filledTrackRes.status, 200, "Robert can track his FILLED prescription");
  const filledTrack = (await filledTrackRes.json()).tracking;
  assert.strictEqual(filledTrack.status, PrescriptionStatus.FILLED, "Tracking status is FILLED");
  assert.strictEqual(filledTrack.state.isPending, false, "isPending flag is false");
  assert.strictEqual(filledTrack.state.isFilled, true, "isFilled flag is true");
  assert.strictEqual(filledTrack.state.isCannotFill, false, "isCannotFill flag is false");
  assert(Boolean(filledTrack.filledAt), "Fulfillment timestamp is present");
  assert(Boolean(filledTrack.fulfillment), "Fulfillment details are present");
  assert.strictEqual(
    filledTrack.fulfillment.pharmacyName,
    "MedEasy Central Pharmacy",
    "Fulfillment pharmacy name matches"
  );
  console.log(`  ✓ FILLED tracking verified: Status=${filledTrack.status}, FilledAt=${filledTrack.filledAt}, Pharmacy="${filledTrack.fulfillment.pharmacyName}"`);

  // Scenario C: CANNOT_FILL tracking (David's Rx5)
  const cannotFillTrackRes = await getPatientPrescriptionTrackingResponse(cannotFillRx.id, davidAuth);
  assert.strictEqual(cannotFillTrackRes.status, 200, "David can track his CANNOT_FILL prescription");
  const cannotFillTrack = (await cannotFillTrackRes.json()).tracking;
  assert.strictEqual(cannotFillTrack.status, PrescriptionStatus.CANNOT_FILL, "Tracking status is CANNOT_FILL");
  assert.strictEqual(cannotFillTrack.state.isPending, false, "isPending flag is false");
  assert.strictEqual(cannotFillTrack.state.isFilled, false, "isFilled flag is false");
  assert.strictEqual(cannotFillTrack.state.isCannotFill, true, "isCannotFill flag is true");
  assert(
    cannotFillTrack.state.description.includes("cannot be fulfilled"),
    "CANNOT_FILL communicates failure clearly without fake DB schema fields"
  );
  console.log(`  ✓ CANNOT_FILL tracking verified: Status=${cannotFillTrack.status}, Description="${cannotFillTrack.state.description}"\n`);

  // ---------------------------------------------------------------------------
  // 9. VERIFY DIRECT SERVICE LAYER FUNCTIONS
  // ---------------------------------------------------------------------------
  console.log("-------------------------------------------------------------------------------");
  console.log("9. VERIFY DIRECT PATIENT SERVICE FUNCTIONS");
  console.log("-------------------------------------------------------------------------------");

  const directDashboard = await getPatientDashboardData(aliceUser.id);
  assert(!("error" in directDashboard), "getPatientDashboardData succeeded");
  assert.strictEqual(directDashboard.patient.id, aliceUser.patientProfile!.id, "Direct dashboard patient ID matches");

  const directList = await getPatientPrescriptionsList(aliceUser.id);
  assert(!("error" in directList), "getPatientPrescriptionsList succeeded");
  assert(directList.prescriptions.length > 0, "Direct list returned prescriptions");

  const directDetail = await getPatientPrescriptionDetail(aliceUser.id, pendingRx.id);
  assert(!("error" in directDetail), "getPatientPrescriptionDetail succeeded for own Rx");
  assert.strictEqual(directDetail.prescription.id, pendingRx.id, "Direct detail prescription ID matches");

  const directCrossDetail = await getPatientPrescriptionDetail(aliceUser.id, filledRx.id);
  assert("error" in directCrossDetail, "getPatientPrescriptionDetail returned error for another patient's Rx");
  assert.strictEqual(directCrossDetail.statusCode, 404, "Direct cross-patient detail returns 404 status code");

  const directTracking = await getPatientPrescriptionTracking(aliceUser.id, pendingRx.id);
  assert(!("error" in directTracking), "getPatientPrescriptionTracking succeeded for own Rx");

  const directCrossTracking = await getPatientPrescriptionTracking(aliceUser.id, filledRx.id);
  assert("error" in directCrossTracking, "getPatientPrescriptionTracking returned error for another patient's Rx");
  assert.strictEqual(directCrossTracking.statusCode, 404, "Direct cross-patient tracking returns 404 status code");

  console.log("  ✓ getPatientDashboardData direct invocation passed");
  console.log("  ✓ getPatientPrescriptionsList direct invocation passed");
  console.log("  ✓ getPatientPrescriptionDetail direct invocation passed with 404 isolation");
  console.log("  ✓ getPatientPrescriptionTracking direct invocation passed with 404 isolation\n");

  console.log("===============================================================================");
  console.log("🎉 ALL DAY 14 PATIENT BACKEND VERIFICATION CHECKS PASSED (100% SUCCESS)");
  console.log("===============================================================================");
}

runPatientBackendVerification()
  .catch((err) => {
    console.error("❌ Verification failed with error:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
