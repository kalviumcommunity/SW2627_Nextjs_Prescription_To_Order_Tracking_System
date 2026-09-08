import { PrescriptionStatus, UserRole } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { fulfillPharmacyPrescription, isFulfillmentAction } from "../lib/pharmacy-service";
import { AuthorizationError, requireRole } from "../lib/permissions";

async function main() {
  const [pharmacy, doctor, patient, medicine] = await Promise.all([
    prisma.pharmacyProfile.findFirstOrThrow({ include: { user: true } }),
    prisma.doctorProfile.findFirstOrThrow(),
    prisma.patientProfile.findFirstOrThrow(),
    prisma.medicine.findFirstOrThrow(),
  ]);
  const temporaryPrescriptionIds: string[] = [];
  const createTemporaryPrescription = async () => {
    const prescription = await prisma.prescription.create({
      data: {
        doctorId: doctor.id,
        patientId: patient.id,
        diagnosis: "Temporary pharmacy fulfillment test diagnosis",
        status: PrescriptionStatus.PENDING,
        prescriptionMedicines: {
          create: {
            medicineId: medicine.id,
            dosage: "500mg",
            frequency: "Once daily",
            duration: "5 days",
          },
        },
      },
    });
    temporaryPrescriptionIds.push(prescription.id);
    return prescription;
  };
  try {
  if (isFulfillmentAction("INVALID")) throw new Error("Invalid action was accepted.");
  if (isFulfillmentAction("FILLED")) console.log("Valid action accepted.");
  const pending = await createTemporaryPrescription();

  const filled = await fulfillPharmacyPrescription(pending.id, pharmacy.id, "FILLED");
  if (!filled.success || !filled.prescription || filled.prescription.status !== PrescriptionStatus.FILLED) throw new Error("Valid FILLED fulfillment failed.");
  if (await prisma.fill.count({ where: { prescriptionId: pending.id } }) !== 1) throw new Error("Expected exactly one Fill row.");
  const fill = await prisma.fill.findUniqueOrThrow({ where: { prescriptionId: pending.id } });
  if (fill.pharmacyId !== pharmacy.id) throw new Error("Fill did not use the authenticated pharmacy identity.");
  if ("diagnosis" in (filled.prescription || {})) throw new Error("Pharmacy fulfillment response exposed diagnosis.");

  const duplicate = await fulfillPharmacyPrescription(pending.id, pharmacy.id, "FILLED");
  if (duplicate.success || duplicate.statusCode !== 409) throw new Error("Duplicate fill was not rejected.");
  const cannotFillTarget = await createTemporaryPrescription();
  const cannotFill = await fulfillPharmacyPrescription(cannotFillTarget.id, pharmacy.id, "CANNOT_FILL");
  if (!cannotFill.success || !cannotFill.prescription || cannotFill.prescription.status !== PrescriptionStatus.CANNOT_FILL) throw new Error("Valid CANNOT_FILL fulfillment failed.");
  if (await prisma.fill.count({ where: { prescriptionId: cannotFillTarget.id } }) !== 0) throw new Error("CANNOT_FILL created a successful Fill row.");
  const terminal = await fulfillPharmacyPrescription(cannotFillTarget.id, pharmacy.id, "FILLED");
  if (terminal.success || terminal.statusCode !== 409) throw new Error("Terminal prescription was reprocessed.");

  const concurrentTarget = await createTemporaryPrescription();
  const concurrent = await Promise.all([fulfillPharmacyPrescription(concurrentTarget.id, pharmacy.id, "FILLED"), fulfillPharmacyPrescription(concurrentTarget.id, pharmacy.id, "FILLED")]);
  if (concurrent.filter((result) => result.success).length !== 1) throw new Error("Concurrent fulfillment did not produce exactly one success.");
  if (await prisma.fill.count({ where: { prescriptionId: concurrentTarget.id } }) !== 1) throw new Error("Concurrent fulfillment produced an invalid Fill count.");

  const nonexistent = await fulfillPharmacyPrescription("missing-prescription", pharmacy.id, "FILLED");
  if (nonexistent.success || nonexistent.statusCode !== 404) throw new Error("Missing prescription was not 404.");
  let wrongRoleRejected = false;
  try { await requireRole(UserRole.PHARMACY, { id: pharmacy.user.id, email: pharmacy.user.email, role: UserRole.PATIENT }); } catch (error) { wrongRoleRejected = error instanceof AuthorizationError && error.statusCode === 403; }
  if (!wrongRoleRejected) throw new Error("Wrong role was not rejected.");
  let unauthenticatedRejected = false;
  try { await requireRole(UserRole.PHARMACY, null); } catch (error) { unauthenticatedRejected = error instanceof AuthorizationError && error.statusCode === 401; }
  if (!unauthenticatedRejected) throw new Error("Unauthenticated access was not rejected.");
  console.log("Pharmacy fulfillment tests passed.");
  } finally {
    await prisma.fill.deleteMany({ where: { prescriptionId: { in: temporaryPrescriptionIds } } });
    await prisma.prescriptionMedicine.deleteMany({ where: { prescriptionId: { in: temporaryPrescriptionIds } } });
    await prisma.prescription.deleteMany({ where: { id: { in: temporaryPrescriptionIds } } });
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(async () => { await prisma.$disconnect(); });
