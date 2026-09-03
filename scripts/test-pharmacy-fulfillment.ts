import { PrescriptionStatus, UserRole } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { fulfillPharmacyPrescription, isFulfillmentAction } from "../lib/pharmacy-service";
import { AuthorizationError, requireRole } from "../lib/permissions";

async function main() {
  const pharmacy = await prisma.pharmacyProfile.findFirstOrThrow({
    include: { user: true },
  });
  if (isFulfillmentAction("INVALID")) throw new Error("Invalid action was accepted.");
  if (isFulfillmentAction("FILLED")) {
    console.log("Valid action accepted.");
  }
  const pending = await prisma.prescription.findFirstOrThrow({
    where: { status: PrescriptionStatus.PENDING },
  });

  const filled = await fulfillPharmacyPrescription(pending.id, pharmacy.id, "FILLED");
  if (!filled.success || filled.prescription.status !== PrescriptionStatus.FILLED) {
    throw new Error("Valid FILLED fulfillment failed.");
  }

  const fillRows = await prisma.fill.count({ where: { prescriptionId: pending.id } });
  if (fillRows !== 1) throw new Error(`Expected exactly one Fill row, got ${fillRows}.`);

  const duplicate = await fulfillPharmacyPrescription(pending.id, pharmacy.id, "FILLED");
  if (duplicate.success || duplicate.statusCode !== 409) throw new Error("Duplicate fill was not rejected.");

  const cannotFillTarget = await prisma.prescription.findFirstOrThrow({
    where: { status: PrescriptionStatus.PENDING, id: { not: pending.id } },
  });
  const cannotFill = await fulfillPharmacyPrescription(cannotFillTarget.id, pharmacy.id, "CANNOT_FILL");
  if (!cannotFill.success || cannotFill.prescription.status !== PrescriptionStatus.CANNOT_FILL) {
    throw new Error("Valid CANNOT_FILL fulfillment failed.");
  }

  const cannotFillRows = await prisma.fill.count({ where: { prescriptionId: cannotFillTarget.id } });
  if (cannotFillRows !== 0) throw new Error("CANNOT_FILL created a successful Fill row.");

  const terminal = await fulfillPharmacyPrescription(cannotFillTarget.id, pharmacy.id, "FILLED");
  if (terminal.success || terminal.statusCode !== 409) throw new Error("Terminal prescription was reprocessed.");

  const concurrentTarget = await prisma.prescription.findFirstOrThrow({
    where: { status: PrescriptionStatus.PENDING, id: { not: pending.id, notIn: [cannotFillTarget.id] } },
  });
  const concurrent = await Promise.all([
    fulfillPharmacyPrescription(concurrentTarget.id, pharmacy.id, "FILLED"),
    fulfillPharmacyPrescription(concurrentTarget.id, pharmacy.id, "FILLED"),
  ]);
  if (concurrent.filter((result) => result.success).length !== 1) {
    throw new Error("Concurrent fulfillment did not produce exactly one success.");
  }
  if (await prisma.fill.count({ where: { prescriptionId: concurrentTarget.id } }) !== 1) {
    throw new Error("Concurrent fulfillment produced an invalid Fill count.");
  }

  const nonexistent = await fulfillPharmacyPrescription("missing-prescription", pharmacy.id, "FILLED");
  if (nonexistent.success || nonexistent.statusCode !== 404) throw new Error("Missing prescription was not 404.");

  let wrongRoleRejected = false;
  try {
    await requireRole(UserRole.PHARMACY, { id: pharmacy.user.id, email: pharmacy.user.email, role: UserRole.PATIENT });
  } catch (error) {
    wrongRoleRejected = error instanceof AuthorizationError && error.statusCode === 403;
  }
  if (!wrongRoleRejected) throw new Error("Wrong role was not rejected.");

  let unauthenticatedRejected = false;
  try {
    await requireRole(UserRole.PHARMACY, null);
  } catch (error) {
    unauthenticatedRejected = error instanceof AuthorizationError && error.statusCode === 401;
  }
  if (!unauthenticatedRejected) throw new Error("Unauthenticated access was not rejected.");

  console.log("Pharmacy fulfillment tests passed.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(async () => {
  await prisma.$disconnect();
});