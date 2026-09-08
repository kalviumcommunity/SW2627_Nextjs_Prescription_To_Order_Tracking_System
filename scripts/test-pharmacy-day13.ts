import assert from "node:assert";
import { PrescriptionStatus, UserRole } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { AuthUser } from "../lib/permissions";
import {
  fulfillPrescription,
  getPharmacyAnalytics,
  getPharmacyDashboardData,
  getPharmacyHistory,
} from "../lib/pharmacy-service";
import { GET as analyticsRoute } from "../app/api/pharmacy/analytics/route";
import { GET as historyRoute } from "../app/api/pharmacy/history/route";
import { getPharmacyAnalyticsResponse } from "../lib/pharmacy-analytics-route";
import { getPharmacyHistoryResponse } from "../lib/pharmacy-history-route";

function assertDiagnosisAbsent(value: unknown, path = "root") {
  if (!value || typeof value !== "object") return;
  assert(!Object.prototype.hasOwnProperty.call(value, "diagnosis"), `Diagnosis leaked at ${path}`);
  for (const [key, child] of Object.entries(value)) assertDiagnosisAbsent(child, `${path}.${key}`);
}

async function runDay13Verification() {
  const [pharmacyUser, doctorUser, patientUser, medicine] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { email: "pharmacy@medeasy.demo" }, include: { pharmacyProfile: true } }),
    prisma.user.findUniqueOrThrow({ where: { email: "dr.sarah@medeasy.demo" }, include: { doctorProfile: true } }),
    prisma.user.findUniqueOrThrow({ where: { email: "patient.alice@medeasy.demo" }, include: { patientProfile: true } }),
    prisma.medicine.findFirstOrThrow(),
  ]);

  const pharmacyAuth: AuthUser = { id: pharmacyUser.id, email: pharmacyUser.email, role: UserRole.PHARMACY };
  const doctorAuth: AuthUser = { id: doctorUser.id, email: doctorUser.email, role: UserRole.DOCTOR };
  const patientAuth: AuthUser = { id: patientUser.id, email: patientUser.email, role: UserRole.PATIENT };
  const trackedIds: string[] = [];

  try {
    for (const [route, response] of [[analyticsRoute, getPharmacyAnalyticsResponse], [historyRoute, getPharmacyHistoryResponse]] as const) {
      assert.strictEqual((await route()).status, 401, "Unauthenticated pharmacy endpoint returns 401");
      assert.strictEqual((await response(doctorAuth)).status, 403, "Doctor pharmacy endpoint access returns 403");
      assert.strictEqual((await response(patientAuth)).status, 403, "Patient pharmacy endpoint access returns 403");
      assert.strictEqual((await response(pharmacyAuth)).status, 200, "Pharmacy endpoint access returns 200");
    }

    const [analytics, dashboard, history] = await Promise.all([
      getPharmacyAnalytics(pharmacyUser.id),
      getPharmacyDashboardData(pharmacyUser.id),
      getPharmacyHistory(pharmacyUser.id),
    ]);
    assert(!("error" in analytics), "Seeded analytics loads");
    assert(!("error" in dashboard), "Dashboard loads for comparison");
    assert(!("error" in history), "Seeded history loads");
    if ("error" in analytics || "error" in dashboard || "error" in history) return;

    assertDiagnosisAbsent(analytics);
    assertDiagnosisAbsent(history);
    assert(Number.isFinite(analytics.summary.fulfillmentRate), "Seeded fulfillment rate is finite");
    assert.strictEqual(analytics.summary.pendingPrescriptions, dashboard.metrics.pendingPrescriptions, "Dashboard pending count matches analytics");
    assert.strictEqual(analytics.summary.filledPrescriptions, dashboard.metrics.filledPrescriptions, "Dashboard filled count matches analytics");
    assert.strictEqual(analytics.summary.fulfillmentRate, dashboard.metrics.fulfillmentRate, "Dashboard fulfillment rate matches analytics");

    const pharmacyId = pharmacyUser.pharmacyProfile!.id;
    const [pendingCount, cannotFillCount, filledCount] = await Promise.all([
      prisma.prescription.count({ where: { status: PrescriptionStatus.PENDING } }),
      prisma.prescription.count({ where: { status: PrescriptionStatus.CANNOT_FILL } }),
      prisma.fill.count({ where: { pharmacyId } }),
    ]);
    assert.strictEqual(analytics.summary.pendingPrescriptions, pendingCount, "Pending count matches direct DB query");
    assert.strictEqual(analytics.summary.cannotFillPrescriptions, cannotFillCount, "Cannot-fill count matches direct DB query");
    assert.strictEqual(analytics.summary.filledPrescriptions, filledCount, "Filled count matches pharmacy Fill rows");
    assert.strictEqual(analytics.summary.totalPrescriptionsReceived, pendingCount + cannotFillCount + filledCount, "Total matches component counts");
    assert.strictEqual(analytics.summary.fulfillmentRate, Number(((filledCount / (pendingCount + cannotFillCount + filledCount)) * 100).toFixed(1)), "Rate matches formula");
    assert(history.history.some((item) => item.status === "FILLED" && item.fulfilledAt), "Filled history includes fulfilledAt");
    assert(history.history.every((item) => item.status !== "FILLED" || item.fulfilledAt), "Filled history does not show successful fill without timestamp");

    const createTemporaryPrescription = async () => {
      const prescription = await prisma.prescription.create({
        data: {
          doctorId: doctorUser.doctorProfile!.id,
          patientId: patientUser.patientProfile!.id,
          diagnosis: "PRIVATE DAY 13 TEST DIAGNOSIS",
          status: PrescriptionStatus.PENDING,
          prescriptionMedicines: { create: [{ medicineId: medicine.id, dosage: "1", frequency: "daily", duration: "1 day" }] },
        },
      });
      trackedIds.push(prescription.id);
      return prescription.id;
    };

    const beforeFill = await getPharmacyAnalytics(pharmacyUser.id);
    assert(!("error" in beforeFill), "Analytics loads before dynamic fill");
    const filledId = await createTemporaryPrescription();
    const fillResult = await fulfillPrescription(pharmacyUser.id, filledId, { action: "FILLED" });
    assert(!("error" in fillResult), "Known pending prescription can be filled");
    const afterFill = await getPharmacyAnalytics(pharmacyUser.id);
    const afterFillHistory = await getPharmacyHistory(pharmacyUser.id);
    assert(!("error" in afterFill) && !("error" in afterFillHistory), "Analytics and history reload after fill");
    if (!("error" in beforeFill) && !("error" in afterFill) && !("error" in afterFillHistory)) {
      assert.strictEqual(afterFill.summary.pendingPrescriptions, beforeFill.summary.pendingPrescriptions, "Pending returns to baseline after filling the newly created prescription");
      assert.strictEqual(afterFill.summary.filledPrescriptions, beforeFill.summary.filledPrescriptions + 1, "Filled increases after fill");
      assert(afterFillHistory.history.some((item) => item.prescriptionId === filledId && item.status === "FILLED" && item.fulfilledAt), "History gains filled record");
    }

    const cannotFillId = await createTemporaryPrescription();
    const cannotFillResult = await fulfillPrescription(pharmacyUser.id, cannotFillId, { action: "CANNOT_FILL" });
    assert(!("error" in cannotFillResult), "Known pending prescription can be marked cannot-fill");
    const cannotFillRow = await prisma.fill.findUnique({ where: { prescriptionId: cannotFillId } });
    assert.strictEqual(cannotFillRow, null, "Cannot-fill transition creates no Fill row");
    const afterCannotFill = await getPharmacyAnalytics(pharmacyUser.id);
    assert(!("error" in afterCannotFill), "Analytics loads after cannot-fill transition");
    if (!("error" in afterFill) && !("error" in afterCannotFill)) {
      assert.strictEqual(afterCannotFill.summary.pendingPrescriptions, afterFill.summary.pendingPrescriptions, "Cannot-fill does not leave the prescription pending");
      assert.strictEqual(afterCannotFill.summary.cannotFillPrescriptions, afterFill.summary.cannotFillPrescriptions + 1, "Cannot-fill count increases");
      assert(afterCannotFill.summary.fulfillmentRate >= 0 && afterCannotFill.summary.fulfillmentRate <= 100, "Rate remains bounded after cannot-fill");
    }

    console.log("Day 13 pharmacy history and analytics verification passed.");
  } finally {
    await prisma.prescription.deleteMany({ where: { id: { in: trackedIds } } });
  }
}

runDay13Verification()
  .catch((error) => {
    console.error("Day 13 pharmacy verification failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
