import { Prisma, PrescriptionStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getPharmacyProfileByUserId } from "@/lib/permissions";

const pharmacyPrescriptionSelect = {
  id: true,
  documentRef: true,
  status: true,
  createdAt: true,
  filledAt: true,
  doctor: {
    select: {
      id: true,
      specialization: true,
      licenseNumber: true,
      phone: true,
      user: { select: { email: true } },
    },
  },
  patient: {
    select: {
      id: true,
      name: true,
      age: true,
      gender: true,
      contactInfo: true,
    },
  },
  prescriptionMedicines: {
    select: {
      id: true,
      dosage: true,
      frequency: true,
      duration: true,
      medicine: {
        select: { id: true, name: true, genericName: true, stockStatus: true },
      },
    },
  },
  fill: {
    select: {
      id: true,
      filledAt: true,
      notes: true,
      pharmacy: { select: { id: true, pharmacyName: true, phone: true } },
    },
  },
} as const;

type PharmacyPrescription = Prisma.PrescriptionGetPayload<{
  select: typeof pharmacyPrescriptionSelect;
}>;

function getDoctorDisplayName(email: string) {
  const name = email.split("@")[0].replace(/^dr\.?/i, "").replace(/[._-]/g, " ");
  return `Dr. ${name
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")}`;
}

function formatPrescription(prescription: PharmacyPrescription) {
  return {
    id: prescription.id,
    documentRef: prescription.documentRef,
    documentAvailable: Boolean(prescription.documentRef),
    status: prescription.status,
    createdAt: prescription.createdAt,
    filledAt: prescription.filledAt,
    doctor: {
      id: prescription.doctor.id,
      name: getDoctorDisplayName(prescription.doctor.user.email),
      email: prescription.doctor.user.email,
      specialization: prescription.doctor.specialization,
      licenseNumber: prescription.doctor.licenseNumber,
      phone: prescription.doctor.phone,
    },
    patient: prescription.patient,
    medicines: prescription.prescriptionMedicines.map((item) => ({
      id: item.id,
      medicine: item.medicine,
      dosage: item.dosage,
      frequency: item.frequency,
      duration: item.duration,
    })),
    fill: prescription.fill,
  };
}

async function getPharmacyOrError(userId: string) {
  const pharmacy = await getPharmacyProfileByUserId(userId);
  return pharmacy || { error: "Pharmacy profile not found.", statusCode: 404 as const };
}

export async function getPharmacyDashboardData(userId: string) {
  const pharmacy = await getPharmacyOrError(userId);
  if ("error" in pharmacy) return pharmacy;

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const startOfTomorrow = new Date(startOfToday);
  startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);

  const [statusGroups, todayFulfillmentCount, recentPrescriptions] = await Promise.all([
    prisma.prescription.groupBy({ by: ["status"], _count: { id: true } }),
    prisma.fill.count({
      where: { pharmacyId: pharmacy.id, filledAt: { gte: startOfToday, lt: startOfTomorrow } },
    }),
    prisma.prescription.findMany({
      take: 10,
      orderBy: { createdAt: "desc" },
      select: pharmacyPrescriptionSelect,
    }),
  ]);

  const counts = {
    pending: 0,
    filled: 0,
    cannotFill: 0,
  };
  for (const group of statusGroups) {
    if (group.status === PrescriptionStatus.PENDING) counts.pending = group._count.id;
    if (group.status === PrescriptionStatus.FILLED) counts.filled = group._count.id;
    if (group.status === PrescriptionStatus.CANNOT_FILL) counts.cannotFill = group._count.id;
  }
  const total = counts.pending + counts.filled + counts.cannotFill;

  return {
    pharmacy: {
      id: pharmacy.id,
      pharmacyName: pharmacy.pharmacyName,
      pharmacyType: pharmacy.pharmacyType,
      licenseNumber: pharmacy.licenseNumber,
    },
    metrics: {
      pendingPrescriptions: counts.pending,
      filledPrescriptions: counts.filled,
      todayFulfillmentCount,
      fulfillmentRate: total > 0 ? Number(((counts.filled / total) * 100).toFixed(1)) : 0,
    },
    pendingCount: counts.pending,
    recentActivity: recentPrescriptions.map(formatPrescription),
  };
}

export async function getPharmacyPrescriptions(userId: string, status?: PrescriptionStatus) {
  const pharmacy = await getPharmacyOrError(userId);
  if ("error" in pharmacy) return pharmacy;

  const prescriptions = await prisma.prescription.findMany({
    where: status ? { status } : undefined,
    orderBy: { createdAt: "desc" },
    select: pharmacyPrescriptionSelect,
  });

  return {
    pharmacy: { id: pharmacy.id, pharmacyName: pharmacy.pharmacyName },
    prescriptions: prescriptions.map(formatPrescription),
  };
}

export async function getPharmacyPrescriptionDetail(userId: string, prescriptionId: string) {
  const pharmacy = await getPharmacyOrError(userId);
  if ("error" in pharmacy) return pharmacy;

  const prescription = await prisma.prescription.findUnique({
    where: { id: prescriptionId },
    select: pharmacyPrescriptionSelect,
  });
  if (!prescription) return { error: "Prescription not found.", statusCode: 404 as const };

  return { prescription: formatPrescription(prescription) };
}