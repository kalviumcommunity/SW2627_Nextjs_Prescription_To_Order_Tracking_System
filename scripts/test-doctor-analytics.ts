import assert from "node:assert";
import { UserRole, PrescriptionStatus } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { AuthUser, requireRole, AuthorizationError } from "../lib/permissions";
import { getDoctorAnalytics } from "../lib/doctor-service";
import { GET as analyticsRouteHandler } from "../app/api/doctor/analytics/route";

async function runDoctorAnalyticsTestSuite() {
  console.log("===============================================================================");
  console.log("🩺 MedEasy Day 10 PR #28 - Doctor Analytics & Fulfillment Verification");
  console.log("===============================================================================\n");

  // 1. Retrieve seeded test users
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
    name: "Alice Johnson",
  };

  // ---------------------------------------------------------------------------
  // TEST SECTION 1: AUTHORIZATION & ACCESS CONTROL
  // ---------------------------------------------------------------------------
  console.log("-------------------------------------------------------------------------------");
  console.log("1. VERIFY AUTHORIZATION & ROLE GUARDS (HTTP 401 & HTTP 403)");
  console.log("-------------------------------------------------------------------------------");

  // 1a. Unauthenticated request rejection (401)
  let unauthRejected = false;
  try {
    await requireRole(UserRole.DOCTOR, null);
  } catch (err) {
    if (err instanceof AuthorizationError && err.statusCode === 401) {
      unauthRejected = true;
    }
  }
  assert(unauthRejected, "Unauthenticated request correctly rejected with HTTP 401");
  console.log("  ✓ Missing session rejected with HTTP 401 Unauthorized");

  // 1b. Admin rejected (403)
  let adminRejected = false;
  try {
    await requireRole(UserRole.DOCTOR, adminAuth);
  } catch (err) {
    if (err instanceof AuthorizationError && err.statusCode === 403) {
      adminRejected = true;
    }
  }
  assert(adminRejected, "Admin role rejected from Doctor Analytics with HTTP 403");
  console.log("  ✓ Admin role correctly rejected with HTTP 403 Forbidden");

  // 1c. Pharmacy rejected (403)
  let pharmacyRejected = false;
  try {
    await requireRole(UserRole.DOCTOR, pharmacyAuth);
  } catch (err) {
    if (err instanceof AuthorizationError && err.statusCode === 403) {
      pharmacyRejected = true;
    }
  }
  assert(pharmacyRejected, "Pharmacy role rejected from Doctor Analytics with HTTP 403");
  console.log("  ✓ Pharmacy role correctly rejected with HTTP 403 Forbidden");

  // 1d. Patient rejected (403)
  let patientRejected = false;
  try {
    await requireRole(UserRole.DOCTOR, patientAuth);
  } catch (err) {
    if (err instanceof AuthorizationError && err.statusCode === 403) {
      patientRejected = true;
    }
  }
  assert(patientRejected, "Patient role rejected from Doctor Analytics with HTTP 403");
  console.log("  ✓ Patient role correctly rejected with HTTP 403 Forbidden");

  // 1e. Route handler enforces 401 for unauthenticated request
  const unauthRouteRes = await analyticsRouteHandler();
  assert(unauthRouteRes.status === 401, "Route handler returns 401 without session");
  console.log("  ✓ Route handler GET /api/doctor/analytics enforces 401 when unauthenticated");

  // ---------------------------------------------------------------------------
  // TEST SECTION 2: DR. SARAH ANALYTICS - LIVE DB CALCULATIONS
  // ---------------------------------------------------------------------------
  console.log("\n-------------------------------------------------------------------------------");
  console.log("2. VERIFY DR. SARAH ANALYTICS - ACCURACY & REAL-TIME DERIVATIONS");
  console.log("-------------------------------------------------------------------------------");

  const sarahDoctorId = doctorSarahDb.doctorProfile!.id;
  const sarahAnalytics = await getDoctorAnalytics(doctorSarahDb.id);
  assert(!("error" in sarahAnalytics), "Dr. Sarah analytics returned successfully");

  // Query raw database counts for Dr. Sarah to cross-verify live derivation
  const [sarahDbTotal, sarahDbFilled, sarahDbPending, sarahDbCannotFill] = await Promise.all([
    prisma.prescription.count({ where: { doctorId: sarahDoctorId } }),
    prisma.prescription.count({ where: { doctorId: sarahDoctorId, status: PrescriptionStatus.FILLED } }),
    prisma.prescription.count({ where: { doctorId: sarahDoctorId, status: PrescriptionStatus.PENDING } }),
    prisma.prescription.count({ where: { doctorId: sarahDoctorId, status: PrescriptionStatus.CANNOT_FILL } }),
  ]);

  assert.strictEqual(sarahAnalytics.summary.totalPrescriptions, sarahDbTotal, "Total prescriptions match DB");
  assert.strictEqual(sarahAnalytics.summary.filledPrescriptions, sarahDbFilled, "Filled prescriptions match DB");
  assert.strictEqual(sarahAnalytics.summary.pendingPrescriptions, sarahDbPending, "Pending prescriptions match DB");
  assert.strictEqual(sarahAnalytics.summary.cannotFillPrescriptions, sarahDbCannotFill, "Cannot fill count matches DB");

  const expectedSarahFillRate = Number(((sarahDbFilled / sarahDbTotal) * 100).toFixed(1));
  assert.strictEqual(sarahAnalytics.summary.overallFillRate, expectedSarahFillRate, "Overall fill rate accurately calculated");

  console.log(`  ✓ Dr. Sarah Summary:`);
  console.log(`    - Total Prescriptions : ${sarahAnalytics.summary.totalPrescriptions}`);
  console.log(`    - Filled Orders       : ${sarahAnalytics.summary.filledPrescriptions}`);
  console.log(`    - Pending Orders      : ${sarahAnalytics.summary.pendingPrescriptions}`);
  console.log(`    - Cannot Fill Orders  : ${sarahAnalytics.summary.cannotFillPrescriptions}`);
  console.log(`    - Overall Fill Rate   : ${sarahAnalytics.summary.overallFillRate}%`);

  // ---------------------------------------------------------------------------
  // TEST SECTION 3: MEDICINE-WISE FILL RATE (DENOMINATOR IS PRESCRIPTIONS COUNT)
  // ---------------------------------------------------------------------------
  console.log("\n-------------------------------------------------------------------------------");
  console.log("3. VERIFY MEDICINE FILL RATE (DENOMINATOR = PRESCRIPTIONS CONTAINING MEDICINE)");
  console.log("-------------------------------------------------------------------------------");

  assert(Array.isArray(sarahAnalytics.medicineFillRates), "medicineFillRates is an array");
  assert(sarahAnalytics.medicineFillRates.length > 0, "Dr. Sarah has prescribed medicines");

  for (const medRate of sarahAnalytics.medicineFillRates) {
    assert(medRate.medicineId, "Medicine has medicineId");
    assert(medRate.name, "Medicine has name");
    assert(typeof medRate.prescribed === "number" && medRate.prescribed > 0, "Prescribed count > 0");
    assert(typeof medRate.filled === "number" && medRate.filled >= 0, "Filled count >= 0");
    assert(typeof medRate.pending === "number" && medRate.pending >= 0, "Pending count >= 0");
    assert(typeof medRate.cannotFill === "number" && medRate.cannotFill >= 0, "Cannot fill count >= 0");
    assert.strictEqual(medRate.prescribed, medRate.filled + medRate.pending + medRate.cannotFill, "Sum of statuses equals prescribed");

    // Exact formula check: Fill Rate = (filled / prescribed) * 100
    const expectedRate = Number(((medRate.filled / medRate.prescribed) * 100).toFixed(1));
    assert.strictEqual(medRate.fillRate, expectedRate, `Fill rate matches formula for ${medRate.name}`);
    assert(medRate.fillRate >= 0 && medRate.fillRate <= 100, "Fill rate is bounded in [0, 100]");

    console.log(`  ✓ ${medRate.name.padEnd(24)}: Prescribed=${medRate.prescribed}, Filled=${medRate.filled}, Rate=${medRate.fillRate}%`);
  }

  // ---------------------------------------------------------------------------
  // TEST SECTION 4: MOST FREQUENTLY PRESCRIBED MEDICINES
  // ---------------------------------------------------------------------------
  console.log("\n-------------------------------------------------------------------------------");
  console.log("4. VERIFY TOP PRESCRIBED MEDICINES RANKING");
  console.log("-------------------------------------------------------------------------------");

  assert(Array.isArray(sarahAnalytics.topMedicines), "topMedicines is an array");
  assert(sarahAnalytics.topMedicines.length <= 5, "topMedicines returns at most top 5");

  for (let i = 0; i < sarahAnalytics.topMedicines.length - 1; i++) {
    const curr = sarahAnalytics.topMedicines[i];
    const next = sarahAnalytics.topMedicines[i + 1];
    assert(curr.prescriptionsCount >= next.prescriptionsCount, "topMedicines sorted descending by frequency");
  }

  const top1 = sarahAnalytics.topMedicines[0];
  assert(top1.percentageOfTotal > 0, "Top medicine has positive share percentage");
  console.log(`  ✓ Top 1 Prescribed: ${top1.name} (${top1.prescriptionsCount} prescriptions, ${top1.percentageOfTotal}% of all orders)`);

  // ---------------------------------------------------------------------------
  // TEST SECTION 5: CLINICIAN ISOLATION (DR. SARAH VS DR. JOHN)
  // ---------------------------------------------------------------------------
  console.log("\n-------------------------------------------------------------------------------");
  console.log("5. VERIFY CLINICIAN DATA ISOLATION (DR. SARAH VS DR. JOHN)");
  console.log("-------------------------------------------------------------------------------");

  const johnDoctorId = doctorJohnDb.doctorProfile!.id;
  const johnAnalytics = await getDoctorAnalytics(doctorJohnDb.id);
  assert(!("error" in johnAnalytics), "Dr. John analytics returned successfully");

  const [johnDbTotal, johnDbFilled, johnDbPending, johnDbCannotFill] = await Promise.all([
    prisma.prescription.count({ where: { doctorId: johnDoctorId } }),
    prisma.prescription.count({ where: { doctorId: johnDoctorId, status: PrescriptionStatus.FILLED } }),
    prisma.prescription.count({ where: { doctorId: johnDoctorId, status: PrescriptionStatus.PENDING } }),
    prisma.prescription.count({ where: { doctorId: johnDoctorId, status: PrescriptionStatus.CANNOT_FILL } }),
  ]);

  assert.strictEqual(johnAnalytics.summary.totalPrescriptions, johnDbTotal, "Dr. John total matches DB");
  assert.strictEqual(johnAnalytics.summary.filledPrescriptions, johnDbFilled, "Dr. John filled matches DB");
  assert.strictEqual(johnAnalytics.summary.pendingPrescriptions, johnDbPending, "Dr. John pending matches DB");
  assert.strictEqual(johnAnalytics.summary.cannotFillPrescriptions, johnDbCannotFill, "Dr. John cannot fill matches DB");

  // Dr. John has CANNOT_FILL prescriptions (3) while Dr. Sarah has 0
  assert.strictEqual(johnAnalytics.summary.cannotFillPrescriptions, 3, "Dr. John reflects 3 CANNOT_FILL orders");
  assert.strictEqual(sarahAnalytics.summary.cannotFillPrescriptions, 0, "Dr. Sarah has 0 CANNOT_FILL orders");

  // Verify clinician isolation: Doctor IDs are distinct and data does not leak
  assert.notStrictEqual(sarahAnalytics.doctor.id, johnAnalytics.doctor.id, "Doctor IDs are distinct");
  assert.notStrictEqual(sarahAnalytics.summary.overallFillRate, johnAnalytics.summary.overallFillRate, "Fill rates reflect individual clinician performance");

  console.log(`  ✓ Dr. John Summary:`);
  console.log(`    - Total Prescriptions : ${johnAnalytics.summary.totalPrescriptions}`);
  console.log(`    - Filled Orders       : ${johnAnalytics.summary.filledPrescriptions}`);
  console.log(`    - Pending Orders      : ${johnAnalytics.summary.pendingPrescriptions}`);
  console.log(`    - Cannot Fill Orders  : ${johnAnalytics.summary.cannotFillPrescriptions}`);
  console.log(`    - Overall Fill Rate   : ${johnAnalytics.summary.overallFillRate}%`);
  console.log("  ✓ Strict clinician isolation verified: zero cross-contamination between doctors");

  // ---------------------------------------------------------------------------
  // TEST SECTION 6: TREND & TIMELINE AGGREGATIONS
  // ---------------------------------------------------------------------------
  console.log("\n-------------------------------------------------------------------------------");
  console.log("6. VERIFY FULFILLMENT TREND & TIMELINE SUMMARY");
  console.log("-------------------------------------------------------------------------------");

  assert(Array.isArray(sarahAnalytics.trend), "Trend is an array");
  assert(sarahAnalytics.trend.length > 0, "Trend contains periods");

  let totalFromTrend = 0;
  for (const t of sarahAnalytics.trend) {
    assert(t.period, "Trend has period string");
    assert(t.label, "Trend has readable label");
    assert(t.total >= t.filled + t.pending + t.cannotFill, "Sum of statuses matches trend total");
    assert(!isNaN(t.fillRate), "Trend fillRate is not NaN");
    totalFromTrend += t.total;
    console.log(`  ✓ Period ${t.label.padEnd(14)}: Total=${t.total}, Filled=${t.filled}, Pending=${t.pending}, Rate=${t.fillRate}%`);
  }
  assert.strictEqual(totalFromTrend, sarahAnalytics.summary.totalPrescriptions, "Trend totals sum to overall total");

  // ---------------------------------------------------------------------------
  // TEST SECTION 7: EDGE CASES (0 PRESCRIPTIONS, 100%, 0%, DIVIDE-BY-ZERO)
  // ---------------------------------------------------------------------------
  console.log("\n-------------------------------------------------------------------------------");
  console.log("7. VERIFY EDGE CONDITIONS (0 PRESCRIPTIONS, 0%, 100%, DIVIDE-BY-ZERO)");
  console.log("-------------------------------------------------------------------------------");

  // 7a. Doctor with 0 prescriptions
  const timestamp = Date.now();
  const dummyDoctorUser = await prisma.user.create({
    data: {
      email: `test.zerodoc.${timestamp}@medeasy.demo`,
      password: "SamplePassword123!",
      role: UserRole.DOCTOR,
      doctorProfile: {
        create: {
          specialization: "Dermatology",
          licenseNumber: `DOC-ZERO-${timestamp}`,
          phone: "+1-555-0999",
        },
      },
    },
    include: { doctorProfile: true },
  });

  try {
    const zeroAnalytics = await getDoctorAnalytics(dummyDoctorUser.id);
    assert(!("error" in zeroAnalytics), "Zero-prescriptions doctor analytics succeeded");

    assert.strictEqual(zeroAnalytics.summary.totalPrescriptions, 0, "Total is 0");
    assert.strictEqual(zeroAnalytics.summary.filledPrescriptions, 0, "Filled is 0");
    assert.strictEqual(zeroAnalytics.summary.pendingPrescriptions, 0, "Pending is 0");
    assert.strictEqual(zeroAnalytics.summary.cannotFillPrescriptions, 0, "Cannot fill is 0");
    assert.strictEqual(zeroAnalytics.summary.overallFillRate, 0, "overallFillRate is 0, NOT NaN");
    assert(!isNaN(zeroAnalytics.summary.overallFillRate), "overallFillRate is not NaN");
    assert(isFinite(zeroAnalytics.summary.overallFillRate), "overallFillRate is finite");

    assert.deepStrictEqual(zeroAnalytics.medicineFillRates, [], "medicineFillRates is empty array");
    assert.deepStrictEqual(zeroAnalytics.topMedicines, [], "topMedicines is empty array");
    assert.deepStrictEqual(zeroAnalytics.trend, [], "trend is empty array");

    console.log("  ✓ Doctor with 0 prescriptions returns clean empty metrics with zero divide-by-zero risk");

    // 7b. Verify 100% and 0% medicine fill rates exist in seeded data
    const allMedRates = [...sarahAnalytics.medicineFillRates, ...johnAnalytics.medicineFillRates];
    const hundredPercent = allMedRates.find((m) => m.fillRate === 100);
    const zeroPercent = allMedRates.find((m) => m.fillRate === 0);
    const mixedPercent = allMedRates.find((m) => m.fillRate > 0 && m.fillRate < 100);

    assert(hundredPercent, "Found 100% fill rate medicine scenario");
    assert(zeroPercent, "Found 0% fill rate medicine scenario");
    assert(mixedPercent, "Found mixed fill rate medicine scenario");

    console.log(`  ✓ 100% Fill Rate Scenario: ${hundredPercent.name} (${hundredPercent.filled}/${hundredPercent.prescribed} = 100%)`);
    console.log(`  ✓ 0% Fill Rate Scenario  : ${zeroPercent.name} (${zeroPercent.filled}/${zeroPercent.prescribed} = 0%)`);
    console.log(`  ✓ Mixed Fill Rate Scenario: ${mixedPercent.name} (${mixedPercent.filled}/${mixedPercent.prescribed} = ${mixedPercent.fillRate}%)`);
  } finally {
    // ---------------------------------------------------------------------------
    // TEST SECTION 8: CLEANUP
    // ---------------------------------------------------------------------------
    await prisma.doctorProfile.deleteMany({ where: { userId: dummyDoctorUser.id } });
    await prisma.user.deleteMany({ where: { id: dummyDoctorUser.id } });
    console.log("\n-------------------------------------------------------------------------------");
    console.log("8. CLEANUP TEMPORARY TEST DATA");
    console.log("-------------------------------------------------------------------------------");
    console.log("  ✓ Cleaned up temporary test doctor account.");
  }

  console.log("\n===============================================================================");
  console.log("🎉 ALL DOCTOR ANALYTICS & FULFILLMENT VERIFICATION TESTS PASSED (100% SUCCESS)!");
  console.log("===============================================================================");
}

runDoctorAnalyticsTestSuite()
  .catch((err) => {
    console.error("\n❌ Doctor Analytics Test Suite Failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
