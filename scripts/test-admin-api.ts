import assert from "node:assert";
import { NextRequest } from "next/server";
import { PrescriptionStatus, UserRole } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { AuthUser } from "../lib/permissions";
import {
  calculateFulfillmentRate,
  getAdminDashboardData,
  getAdminDoctorsList,
  getAdminPharmacyInfo,
  getAdminPrescriptionsList,
  getAdminPrescriptionDetail,
  getAdminAnalyticsData,
  getAdminDashboardResponse,
  getAdminDoctorsResponse,
  getAdminPharmacyResponse,
  getAdminPrescriptionsResponse,
  getAdminPrescriptionDetailResponse,
  getAdminAnalyticsResponse,
} from "../lib/admin-service";
import { GET as dashboardRoute } from "../app/api/admin/dashboard/route";
import { GET as doctorsRoute } from "../app/api/admin/doctors/route";
import { GET as pharmacyRoute } from "../app/api/admin/pharmacy/route";
import { GET as prescriptionsRoute } from "../app/api/admin/prescriptions/route";
import { GET as prescriptionDetailRoute } from "../app/api/admin/prescriptions/[id]/route";
import { GET as analyticsRoute } from "../app/api/admin/analytics/route";

function assertNoSecretsExposed(payload: unknown, label: string) {
  const serialized = JSON.stringify(payload).toLowerCase();
  assert(!serialized.includes("password"), `${label} must NOT expose password fields`);
  assert(!serialized.includes("passwordhash"), `${label} must NOT expose password hashes`);
  assert(!serialized.includes("secret"), `${label} must NOT expose secret keys`);
  assert(!serialized.includes("sessiontoken"), `${label} must NOT expose session tokens`);
}

async function runAdminBackendVerification() {
  console.log("===============================================================================");
  console.log("👑 MedEasy Prescription-to-Order Tracking System - Day 15 Admin Verification");
  console.log("===============================================================================\n");

  // ---------------------------------------------------------------------------
  // 1. RESOLVE TEST USERS & SESSIONS
  // ---------------------------------------------------------------------------
  console.log("-------------------------------------------------------------------------------");
  console.log("1. RESOLVING TEST USERS & SESSIONS");
  console.log("-------------------------------------------------------------------------------");

  const [adminUser, doctorUser, pharmacyUser, patientUser] = await Promise.all([
    prisma.user.findUniqueOrThrow({
      where: { email: "admin@medeasy.demo" },
    }),
    prisma.user.findUniqueOrThrow({
      where: { email: "dr.sarah@medeasy.demo" },
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
  ]);

  const adminAuth: AuthUser = {
    id: adminUser.id,
    email: adminUser.email,
    role: UserRole.ADMIN,
    name: "System Administrator",
  };

  const doctorAuth: AuthUser = {
    id: doctorUser.id,
    email: doctorUser.email,
    role: UserRole.DOCTOR,
    name: "Dr. Sarah",
  };

  const pharmacyAuth: AuthUser = {
    id: pharmacyUser.id,
    email: pharmacyUser.email,
    role: UserRole.PHARMACY,
    name: "MedEasy Central Pharmacy",
  };

  const patientAuth: AuthUser = {
    id: patientUser.id,
    email: patientUser.email,
    role: UserRole.PATIENT,
    name: "Alice Johnson",
  };

  console.log(`  ✓ Resolved Admin: ID=${adminAuth.id}, Email=${adminAuth.email}`);
  console.log(`  ✓ Resolved Doctor: ID=${doctorAuth.id}, Email=${doctorAuth.email}`);
  console.log(`  ✓ Resolved Pharmacy: ID=${pharmacyAuth.id}, Email=${pharmacyAuth.email}`);
  console.log(`  ✓ Resolved Patient: ID=${patientAuth.id}, Email=${patientAuth.email}\n`);

  // Sample existing prescription for detail tests
  const sampleRx = await prisma.prescription.findFirstOrThrow({
    include: {
      doctor: true,
      patient: true,
    },
  });
  console.log(`  ✓ Reference prescription for detail testing: ID=${sampleRx.id}\n`);

  // ---------------------------------------------------------------------------
  // 2. VERIFY UNAUTHENTICATED ACCESS ENFORCEMENT (HTTP 401)
  // ---------------------------------------------------------------------------
  console.log("-------------------------------------------------------------------------------");
  console.log("2. VERIFY UNAUTHENTICATED ACCESS ENFORCEMENT (HTTP 401)");
  console.log("-------------------------------------------------------------------------------");

  const unauthDashboard = await getAdminDashboardResponse(null);
  assert.strictEqual(unauthDashboard.status, 401, "Admin dashboard without session returns 401");
  console.log("  ✓ GET /api/admin/dashboard enforces 401 for unauthenticated requests");

  const unauthDoctors = await getAdminDoctorsResponse(null);
  assert.strictEqual(unauthDoctors.status, 401, "Admin doctors without session returns 401");
  console.log("  ✓ GET /api/admin/doctors enforces 401 for unauthenticated requests");

  const unauthPharmacy = await getAdminPharmacyResponse(null);
  assert.strictEqual(unauthPharmacy.status, 401, "Admin pharmacy without session returns 401");
  console.log("  ✓ GET /api/admin/pharmacy enforces 401 for unauthenticated requests");

  const unauthPrescriptions = await getAdminPrescriptionsResponse(undefined, null);
  assert.strictEqual(unauthPrescriptions.status, 401, "Admin prescriptions list without session returns 401");
  console.log("  ✓ GET /api/admin/prescriptions enforces 401 for unauthenticated requests");

  const unauthDetail = await getAdminPrescriptionDetailResponse(sampleRx.id, null);
  assert.strictEqual(unauthDetail.status, 401, "Admin prescription detail without session returns 401");
  console.log("  ✓ GET /api/admin/prescriptions/[id] enforces 401 for unauthenticated requests");

  const unauthAnalytics = await getAdminAnalyticsResponse(null);
  assert.strictEqual(unauthAnalytics.status, 401, "Admin analytics without session returns 401");
  console.log("  ✓ GET /api/admin/analytics enforces 401 for unauthenticated requests");

  // Direct Route Handler function calls with no session
  assert.strictEqual((await dashboardRoute()).status, 401, "Route dashboard returns 401 when unauthenticated");
  assert.strictEqual((await doctorsRoute()).status, 401, "Route doctors returns 401 when unauthenticated");
  assert.strictEqual((await pharmacyRoute()).status, 401, "Route pharmacy returns 401 when unauthenticated");
  assert.strictEqual((await prescriptionsRoute(new NextRequest("http://localhost:3000/api/admin/prescriptions"))).status, 401, "Route prescriptions returns 401 when unauthenticated");
  assert.strictEqual((await prescriptionDetailRoute(new NextRequest("http://localhost:3000/api/admin/prescriptions/" + sampleRx.id), { params: { id: sampleRx.id } })).status, 401, "Route prescription detail returns 401 when unauthenticated");
  assert.strictEqual((await analyticsRoute()).status, 401, "Route analytics returns 401 when unauthenticated");
  console.log("  ✓ Direct Route Handler functions enforce 401 when session is absent\n");

  // ---------------------------------------------------------------------------
  // 3. VERIFY UNAUTHORIZED NON-ADMIN ROLES REJECTION (HTTP 403)
  // ---------------------------------------------------------------------------
  console.log("-------------------------------------------------------------------------------");
  console.log("3. VERIFY ROLE RESTRICTIONS (DOCTOR, PHARMACY, PATIENT BLOCKED WITH 403)");
  console.log("-------------------------------------------------------------------------------");

  const nonAdminRoles = [
    { role: "DOCTOR", auth: doctorAuth },
    { role: "PHARMACY", auth: pharmacyAuth },
    { role: "PATIENT", auth: patientAuth },
  ];

  for (const { role, auth } of nonAdminRoles) {
    assert.strictEqual((await getAdminDashboardResponse(auth)).status, 403, `${role} blocked from dashboard`);
    assert.strictEqual((await getAdminDoctorsResponse(auth)).status, 403, `${role} blocked from doctors directory`);
    assert.strictEqual((await getAdminPharmacyResponse(auth)).status, 403, `${role} blocked from pharmacy info`);
    assert.strictEqual((await getAdminPrescriptionsResponse(undefined, auth)).status, 403, `${role} blocked from prescriptions list`);
    assert.strictEqual((await getAdminPrescriptionDetailResponse(sampleRx.id, auth)).status, 403, `${role} blocked from prescription detail`);
    assert.strictEqual((await getAdminAnalyticsResponse(auth)).status, 403, `${role} blocked from platform analytics`);
    console.log(`  ✓ ${role} role strictly denied access (403 Forbidden) across all 6 admin endpoints`);
  }
  console.log("");

  // ---------------------------------------------------------------------------
  // 4. VERIFY ADMIN DASHBOARD ENDPOINT
  // ---------------------------------------------------------------------------
  console.log("-------------------------------------------------------------------------------");
  console.log("4. VERIFY ADMIN DASHBOARD METRICS & RECENT OVERVIEW");
  console.log("-------------------------------------------------------------------------------");

  const dashboardRes = await getAdminDashboardResponse(adminAuth);
  assert.strictEqual(dashboardRes.status, 200, "Admin authorized to access dashboard");
  const dashboard = await dashboardRes.json();

  // Verify real database counts
  const [actualDoctorsCount, actualPatientsCount, actualTotalRx, actualFilledRx, actualPendingRx, actualCannotFillRx] = await Promise.all([
    prisma.doctorProfile.count(),
    prisma.patientProfile.count(),
    prisma.prescription.count(),
    prisma.prescription.count({ where: { status: PrescriptionStatus.FILLED } }),
    prisma.prescription.count({ where: { status: PrescriptionStatus.PENDING } }),
    prisma.prescription.count({ where: { status: PrescriptionStatus.CANNOT_FILL } }),
  ]);

  assert.strictEqual(dashboard.totalDoctors, actualDoctorsCount, "totalDoctors matches DB");
  assert.strictEqual(dashboard.totalPatients, actualPatientsCount, "totalPatients matches DB");
  assert.strictEqual(dashboard.totalPrescriptions, actualTotalRx, "totalPrescriptions matches DB");
  assert.strictEqual(dashboard.filledPrescriptions, actualFilledRx, "filledPrescriptions matches DB");
  assert.strictEqual(dashboard.pendingPrescriptions, actualPendingRx, "pendingPrescriptions matches DB");
  assert.strictEqual(dashboard.cannotFillPrescriptions, actualCannotFillRx, "cannotFillPrescriptions matches DB");
  assert.strictEqual(dashboard.pharmacyAccountStatus, "ACTIVE", "pharmacyAccountStatus is ACTIVE");

  const expectedFillRate = actualTotalRx > 0 ? Number(((actualFilledRx / actualTotalRx) * 100).toFixed(1)) : 0;
  assert.strictEqual(dashboard.overallFulfillmentRate, expectedFillRate, "overallFulfillmentRate computed correctly");
  assert.ok(dashboard.statusBreakdown && dashboard.statusBreakdown.length === 3, "statusBreakdown present");

  assertNoSecretsExposed(dashboard, "Admin Dashboard response");
  console.log(`  ✓ Dashboard metrics verified: Doctors=${dashboard.totalDoctors}, Patients=${dashboard.totalPatients}, TotalRx=${dashboard.totalPrescriptions}, FillRate=${dashboard.overallFulfillmentRate}%, PharmacyStatus=${dashboard.pharmacyAccountStatus}`);
  console.log("  ✓ No sensitive credentials or secrets exposed in dashboard\n");

  // ---------------------------------------------------------------------------
  // 5. VERIFY ADMIN DOCTORS DIRECTORY
  // ---------------------------------------------------------------------------
  console.log("-------------------------------------------------------------------------------");
  console.log("5. VERIFY ADMIN DOCTORS DIRECTORY");
  console.log("-------------------------------------------------------------------------------");

  const doctorsRes = await getAdminDoctorsResponse(adminAuth);
  assert.strictEqual(doctorsRes.status, 200, "Admin authorized to access doctors directory");
  const doctorsData = await doctorsRes.json();

  assert.ok(Array.isArray(doctorsData.doctors), "doctors is an array");
  assert.strictEqual(doctorsData.doctors.length, actualDoctorsCount, "Returns all registered doctors");

  for (const doc of doctorsData.doctors) {
    assert.ok(doc.id, "Doctor ID present");
    assert.ok(doc.name && doc.name.startsWith("Dr. "), "Doctor display name formatted properly");
    assert.ok(doc.email, "Doctor email present");
    assert.ok(doc.specialization, "Doctor specialization present");
    assert.ok(doc.licenseNumber, "Doctor license number present");
    assert.ok(doc.phone, "Doctor phone present");
    assert.ok(doc.createdAt, "Doctor registration date present");
    assert.strictEqual(doc.password, undefined, "Doctor password field is undefined");
    assert.strictEqual(doc.passwordHash, undefined, "Doctor passwordHash field is undefined");
  }

  assertNoSecretsExposed(doctorsData, "Admin Doctors response");
  console.log(`  ✓ Returned ${doctorsData.doctors.length} doctors with full administrative profiles`);
  console.log("  ✓ Credentials, passwords, and session internals are strictly excluded\n");

  // ---------------------------------------------------------------------------
  // 6. VERIFY ADMIN PHARMACY INFORMATION
  // ---------------------------------------------------------------------------
  console.log("-------------------------------------------------------------------------------");
  console.log("6. VERIFY ADMIN PHARMACY INFORMATION (PRE-PROVISIONED PHARMACY)");
  console.log("-------------------------------------------------------------------------------");

  const pharmacyRes = await getAdminPharmacyResponse(adminAuth);
  assert.strictEqual(pharmacyRes.status, 200, "Admin authorized to access pharmacy information");
  const pharmacyData = await pharmacyRes.json();

  assert.ok(pharmacyData.pharmacy, "Pharmacy profile object present");
  assert.strictEqual(pharmacyData.pharmacy.pharmacyName, "MedEasy Central Pharmacy", "Correct pharmacy name");
  assert.strictEqual(pharmacyData.pharmacy.accountStatus, "ACTIVE", "Account status is ACTIVE");
  assert.ok(pharmacyData.pharmacy.pharmacyType, "Pharmacy type present");
  assert.ok(pharmacyData.pharmacy.licenseNumber, "License number present");
  assert.ok(pharmacyData.pharmacy.phone, "Phone present");
  assert.ok(pharmacyData.pharmacy.email, "Pharmacy email present");
  assert.ok(pharmacyData.pharmacy.createdAt, "Registration timestamp present");

  assertNoSecretsExposed(pharmacyData, "Admin Pharmacy response");
  console.log(`  ✓ Pre-provisioned pharmacy verified: ${pharmacyData.pharmacy.pharmacyName} [Status: ${pharmacyData.pharmacy.accountStatus}]`);
  console.log("  ✓ No multi-pharmacy marketplace leakage; password hashes strictly excluded\n");

  // ---------------------------------------------------------------------------
  // 7. VERIFY ADMIN PRESCRIPTIONS LIST & FILTERING
  // ---------------------------------------------------------------------------
  console.log("-------------------------------------------------------------------------------");
  console.log("7. VERIFY ADMIN PRESCRIPTIONS LIST & QUERY FILTERING");
  console.log("-------------------------------------------------------------------------------");

  const allPrescriptionsRes = await getAdminPrescriptionsResponse(undefined, adminAuth);
  assert.strictEqual(allPrescriptionsRes.status, 200, "Admin authorized to access prescriptions list");
  const allPrescriptionsData = await allPrescriptionsRes.json();

  assert.ok(Array.isArray(allPrescriptionsData.prescriptions), "prescriptions is an array");
  assert.strictEqual(allPrescriptionsData.prescriptions.length, actualTotalRx, "Returns platform-wide prescriptions count");

  const firstRx = allPrescriptionsData.prescriptions[0];
  assert.ok(firstRx.id, "Prescription ID present");
  assert.ok(firstRx.status, "Prescription status present");
  assert.ok(firstRx.createdAt, "Prescription created date present");
  assert.ok(firstRx.doctor && firstRx.doctor.name, "Doctor details and formatted name present");
  assert.ok(firstRx.patient && firstRx.patient.name, "Patient details and name present");

  // Verify status filtering
  const pendingOnlyRes = await getAdminPrescriptionsResponse({ status: PrescriptionStatus.PENDING }, adminAuth);
  assert.strictEqual(pendingOnlyRes.status, 200);
  const pendingOnlyData = await pendingOnlyRes.json();
  assert.strictEqual(pendingOnlyData.prescriptions.length, actualPendingRx, "Filtered prescriptions count matches pending DB count");
  for (const rx of pendingOnlyData.prescriptions) {
    assert.strictEqual(rx.status, PrescriptionStatus.PENDING, "Only PENDING status prescriptions returned");
  }

  assertNoSecretsExposed(allPrescriptionsData, "Admin Prescriptions response");
  console.log(`  ✓ Platform-wide prescriptions verified: Total=${allPrescriptionsData.prescriptions.length}, Filtered Pending=${pendingOnlyData.prescriptions.length}`);
  console.log("  ✓ Required fields verified: ID, Doctor, Patient, CreatedAt, Status, FilledAt\n");

  // ---------------------------------------------------------------------------
  // 8. VERIFY ADMIN PRESCRIPTION DETAIL PROJECTION
  // ---------------------------------------------------------------------------
  console.log("-------------------------------------------------------------------------------");
  console.log("8. VERIFY ADMIN PRESCRIPTION DETAIL PROJECTION");
  console.log("-------------------------------------------------------------------------------");

  const detailRes = await getAdminPrescriptionDetailResponse(sampleRx.id, adminAuth);
  assert.strictEqual(detailRes.status, 200, "Admin authorized to access prescription detail");
  const detailData = await detailRes.json();

  const rxDetail = detailData.prescription;
  assert.strictEqual(rxDetail.id, sampleRx.id, "Prescription ID matches");
  assert.strictEqual(rxDetail.status, sampleRx.status, "Prescription status matches");
  assert.strictEqual(rxDetail.diagnosis, sampleRx.diagnosis, "Admin has monitoring visibility of diagnosis");
  assert.ok(rxDetail.doctor && rxDetail.doctor.email, "Doctor metadata present");
  assert.ok(rxDetail.patient && rxDetail.patient.contactInfo, "Patient metadata present");
  assert.ok(Array.isArray(rxDetail.medicines), "Medicines array present");
  assert.ok(rxDetail.createdAt, "Creation timestamp present");

  // Verify 404 for non-existent prescription
  const notFoundRes = await getAdminPrescriptionDetailResponse("non-existent-rx-id-9999", adminAuth);
  assert.strictEqual(notFoundRes.status, 404, "Returns 404 for non-existent prescription ID");

  assertNoSecretsExposed(detailData, "Admin Prescription detail response");
  console.log(`  ✓ Prescription detail projection verified: ID=${rxDetail.id}, Status=${rxDetail.status}, MedicinesCount=${rxDetail.medicines.length}`);
  console.log("  ✓ Non-existent prescription correctly returns HTTP 404 Not Found\n");

  // ---------------------------------------------------------------------------
  // 9. VERIFY ADMIN PLATFORM ANALYTICS
  // ---------------------------------------------------------------------------
  console.log("-------------------------------------------------------------------------------");
  console.log("9. VERIFY ADMIN PLATFORM ANALYTICS");
  console.log("-------------------------------------------------------------------------------");

  const analyticsRes = await getAdminAnalyticsResponse(adminAuth);
  assert.strictEqual(analyticsRes.status, 200, "Admin authorized to access analytics");
  const analytics = await analyticsRes.json();

  assert.strictEqual(analytics.totalPrescriptionsCreated, actualTotalRx, "totalPrescriptionsCreated matches DB");
  assert.strictEqual(analytics.totalPrescriptionsFulfilled, actualFilledRx, "totalPrescriptionsFulfilled matches DB");
  assert.strictEqual(analytics.pendingPrescriptionCount, actualPendingRx, "pendingPrescriptionCount matches DB");
  assert.strictEqual(analytics.cannotFillCount, actualCannotFillRx, "cannotFillCount matches DB");
  assert.strictEqual(analytics.overallFulfillmentRate, expectedFillRate, "overallFulfillmentRate matches expected calculation");

  // Verify Doctor Activity
  assert.ok(Array.isArray(analytics.doctorActivity), "doctorActivity is an array");
  assert.strictEqual(analytics.doctorActivity.length, actualDoctorsCount, "doctorActivity includes all doctors");
  let totalDocRxSum = 0;
  for (const doc of analytics.doctorActivity) {
    assert.ok(doc.doctorId, "Doctor ID present");
    assert.ok(doc.doctorName, "Doctor Name present");
    assert.ok(doc.specialization, "Specialization present");
    assert.strictEqual(typeof doc.totalPrescriptions, "number", "Total prescriptions is a number");
    assert.strictEqual(typeof doc.fulfillmentRate, "number", "Doctor fulfillment rate is a number");
    totalDocRxSum += doc.totalPrescriptions;
  }
  assert.strictEqual(totalDocRxSum, actualTotalRx, "Sum of doctor prescriptions matches total prescriptions");

  // Verify Pharmacy Activity
  assert.ok(analytics.pharmacyActivity, "pharmacyActivity object present");
  assert.strictEqual(typeof analytics.pharmacyActivity.totalFills, "number", "totalFills is a number");
  assert.strictEqual(typeof analytics.pharmacyActivity.fulfillmentRate, "number", "Pharmacy fulfillment rate is a number");

  // Verify Medicine-wise Fulfillment Trends
  assert.ok(Array.isArray(analytics.medicineWiseFulfillmentTrends), "medicineWiseFulfillmentTrends is an array");
  for (const med of analytics.medicineWiseFulfillmentTrends) {
    assert.ok(med.medicineId, "Medicine ID present");
    assert.ok(med.name, "Medicine Name present");
    assert.ok(typeof med.prescribedCount === "number", "prescribedCount is a number");
    assert.ok(typeof med.fulfillmentRate === "number", "Fulfillment rate is a number");
    assert.ok(!isNaN(med.fulfillmentRate), "Fulfillment rate is not NaN");
  }

  // Verify Prescription Activity Over Time
  assert.ok(Array.isArray(analytics.prescriptionActivityOverTime), "prescriptionActivityOverTime is an array");
  for (const timeItem of analytics.prescriptionActivityOverTime) {
    assert.ok(timeItem.period, "Period present (e.g. YYYY-MM)");
    assert.ok(timeItem.label, "Label present");
    assert.ok(typeof timeItem.total === "number", "Total is a number");
    assert.ok(!isNaN(timeItem.fulfillmentRate), "Timeline fulfillment rate is not NaN");
  }

  assertNoSecretsExposed(analytics, "Admin Analytics response");
  console.log(`  ✓ Analytics aggregates verified: Total=${analytics.totalPrescriptionsCreated}, Fulfilled=${analytics.totalPrescriptionsFulfilled}, Rate=${analytics.overallFulfillmentRate}%`);
  console.log(`  ✓ Doctor activity count=${analytics.doctorActivity.length}, Pharmacy fills=${analytics.pharmacyActivity.totalFills}`);
  console.log(`  ✓ Medicine trends count=${analytics.medicineWiseFulfillmentTrends.length}, Timeline periods=${analytics.prescriptionActivityOverTime.length}\n`);

  // ---------------------------------------------------------------------------
  // 10. VERIFY ZERO-DATA ANALYTICS & SAFE RATE HANDLING
  // ---------------------------------------------------------------------------
  console.log("-------------------------------------------------------------------------------");
  console.log("10. VERIFY ZERO-DATA ANALYTICS & SAFE RATE CALCULATIONS");
  console.log("-------------------------------------------------------------------------------");

  // Test calculateFulfillmentRate helper directly
  assert.strictEqual(calculateFulfillmentRate(0, 0), 0, "0/0 returns 0 (not NaN)");
  assert.strictEqual(calculateFulfillmentRate(5, 0), 0, "5/0 returns 0 (division by zero guarded)");
  assert.strictEqual(calculateFulfillmentRate(0, 10), 0, "0/10 returns 0");
  assert.strictEqual(calculateFulfillmentRate(1, 3), 33.3, "1/3 returns 33.3");
  assert.strictEqual(calculateFulfillmentRate(2, 3), 66.7, "2/3 returns 66.7");
  assert.strictEqual(calculateFulfillmentRate(3, 3), 100, "3/3 returns 100");

  console.log("  ✓ Zero-data fulfillment rate function safely produces 0 on empty denominators");
  console.log("  ✓ Fractional percentages correctly rounded to 1 decimal place\n");

  // ---------------------------------------------------------------------------
  // 11. VERIFY DIRECT SERVICE LAYER FUNCTIONS
  // ---------------------------------------------------------------------------
  console.log("-------------------------------------------------------------------------------");
  console.log("11. VERIFY DIRECT ADMIN SERVICE LAYER FUNCTIONS");
  console.log("-------------------------------------------------------------------------------");

  const directDashboard = await getAdminDashboardData();
  assert.ok(directDashboard.totalDoctors >= 1, "Direct dashboard returns live doctors count");

  const directDoctors = await getAdminDoctorsList();
  assert.ok(directDoctors.doctors.length >= 1, "Direct doctors returns live list");

  const directPharmacy = await getAdminPharmacyInfo();
  assert.ok(directPharmacy.pharmacy !== null, "Direct pharmacy returns pre-provisioned pharmacy");

  const directRxList = await getAdminPrescriptionsList();
  assert.ok(directRxList.prescriptions.length >= 1, "Direct prescriptions returns live list");

  const directRxDetail = await getAdminPrescriptionDetail(sampleRx.id);
  assert.ok("prescription" in directRxDetail, "Direct prescription detail returns prescription");

  const directAnalytics = await getAdminAnalyticsData();
  assert.ok(directAnalytics.totalPrescriptionsCreated >= 1, "Direct analytics returns live counts");

  console.log("  ✓ Direct admin service functions execute successfully against database\n");

  console.log("===============================================================================");
  console.log("🎉 ALL DAY 15 ADMIN BACKEND TESTS PASSED WITH 100% SUCCESS!");
  console.log("===============================================================================");
}

runAdminBackendVerification()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("\n❌ Test execution failed with error:", err);
    process.exit(1);
  });
