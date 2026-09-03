import assert from "node:assert";
import { PrescriptionStatus, UserRole } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { AuthUser, AuthorizationError, requireRole } from "../lib/permissions";
import { getPharmacyDashboardData, getPharmacyPrescriptionDetail, getPharmacyPrescriptions } from "../lib/pharmacy-service";
import { GET as pharmacyDashboardRoute } from "../app/api/pharmacy/dashboard/route";

function assertDiagnosisAbsent(value: unknown) {
  if (!value || typeof value !== "object") return;
  assert(!Object.prototype.hasOwnProperty.call(value, "diagnosis"), "Pharmacy response must not expose diagnosis");
  for (const child of Object.values(value)) assertDiagnosisAbsent(child);
}

async function runPharmacyApiTestSuite() {
  const [pharmacyDb, adminDb, doctorDb, patientDb] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { email: "pharmacy@medeasy.demo" } }),
    prisma.user.findUniqueOrThrow({ where: { email: "admin@medeasy.demo" } }),
    prisma.user.findUniqueOrThrow({ where: { email: "dr.sarah@medeasy.demo" } }),
    prisma.user.findUniqueOrThrow({ where: { email: "patient.alice@medeasy.demo" } }),
  ]);

  const pharmacyAuth: AuthUser = { id: pharmacyDb.id, email: pharmacyDb.email, role: UserRole.PHARMACY };
  const wrongRoleUsers: AuthUser[] = [
    { id: adminDb.id, email: adminDb.email, role: UserRole.ADMIN },
    { id: doctorDb.id, email: doctorDb.email, role: UserRole.DOCTOR },
    { id: patientDb.id, email: patientDb.email, role: UserRole.PATIENT },
  ];

  const unauthenticatedResponse = await pharmacyDashboardRoute();
  assert.strictEqual(unauthenticatedResponse.status, 401, "Dashboard rejects unauthenticated requests");

  for (const user of wrongRoleUsers) {
    await assert.rejects(
      requireRole(UserRole.PHARMACY, user),
      (error: unknown) => error instanceof AuthorizationError && error.statusCode === 403,
    );
  }

  const [dashboard, allPrescriptions, databaseStatusGroups] = await Promise.all([
    getPharmacyDashboardData(pharmacyAuth.id),
    getPharmacyPrescriptions(pharmacyAuth.id),
    prisma.prescription.groupBy({ by: ["status"], _count: { id: true } }),
  ]);
  assert(!("error" in dashboard), "Pharmacy dashboard returned successfully");
  assert(!("error" in allPrescriptions), "Pharmacy prescription list returned successfully");
  assert.strictEqual(allPrescriptions.prescriptions.length, databaseStatusGroups.reduce((sum, group) => sum + group._count.id, 0));
  assertDiagnosisAbsent(dashboard);
  assertDiagnosisAbsent(allPrescriptions);
  assert(Number.isFinite(dashboard.metrics.fulfillmentRate), "Fulfillment rate is finite");
  assert.strictEqual(dashboard.pendingCount, dashboard.metrics.pendingPrescriptions);

  const firstPrescription = allPrescriptions.prescriptions[0];
  assert(firstPrescription, "Seed data contains a pharmacy prescription");
  const detail = await getPharmacyPrescriptionDetail(pharmacyAuth.id, firstPrescription.id);
  assert(!("error" in detail), "Pharmacy prescription detail returned successfully");
  assertDiagnosisAbsent(detail);
  assert(detail.prescription.patient.name, "Detail includes patient information");
  assert(detail.prescription.doctor.name, "Detail includes doctor information");
  assert(detail.prescription.medicines.length > 0, "Detail includes medicines");

  const missingDetail = await getPharmacyPrescriptionDetail(pharmacyAuth.id, "missing-prescription-id");
  assert("error" in missingDetail && missingDetail.statusCode === 404, "Missing prescription returns 404");

  for (const status of Object.values(PrescriptionStatus)) {
    const result = await getPharmacyPrescriptions(pharmacyAuth.id, status);
    assert(!("error" in result), `Status filter ${status} returned successfully`);
    const expectedCount = await prisma.prescription.count({ where: { status } });
    assert.strictEqual(result.prescriptions.length, expectedCount, `${status} filter matches database count`);
    assert(result.prescriptions.every((prescription) => prescription.status === status), `${status} filter contains only matching records`);
    assertDiagnosisAbsent(result);
  }

  console.log("Pharmacy API verification passed: 401, 403, dashboard, filters, detail, 404, and diagnosis redaction.");
}

runPharmacyApiTestSuite()
  .catch((error) => {
    console.error("Pharmacy API verification failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });