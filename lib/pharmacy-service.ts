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

const pharmacyHistorySelect = {
  id: true,
  status: true,
  createdAt: true,
  filledAt: true,
  doctor: {
    select: {
      user: { select: { email: true } },
    },
  },
  patient: { select: { name: true } },
  fill: {
    select: {
      pharmacyId: true,
      filledAt: true,
    },
  },
} as const;

function formatPharmacyHistory(
  prescription: Prisma.PrescriptionGetPayload<{ select: typeof pharmacyHistorySelect }>
) {
  return {
    prescriptionId: prescription.id,
    patientName: prescription.patient.name,
    doctorName: getDoctorDisplayName(prescription.doctor.user.email),
    status: prescription.status,
    createdAt: prescription.createdAt,
    fulfilledAt: prescription.fill?.filledAt ?? prescription.filledAt,
  };
}

export async function getPharmacyHistory(userId: string) {
  const pharmacy = await getPharmacyOrError(userId);
  if ("error" in pharmacy) return pharmacy;

  const history = await prisma.prescription.findMany({
    where: {
      OR: [
        { fill: { pharmacyId: pharmacy.id } },
        { status: PrescriptionStatus.PENDING },
        { status: PrescriptionStatus.CANNOT_FILL },
      ],
    },
    select: pharmacyHistorySelect,
    orderBy: { createdAt: "desc" },
  });

  return {
    pharmacy: { id: pharmacy.id, pharmacyName: pharmacy.pharmacyName },
    history: history.map(formatPharmacyHistory),
  };
}

export async function getPharmacyAnalytics(userId: string) {
  const pharmacy = await getPharmacyOrError(userId);
  if ("error" in pharmacy) return pharmacy;

  const [statusGroups, medicineGroups, dailyTrend, weeklyTrend, recentActivity] =
    await Promise.all([
      prisma.prescription.groupBy({
        by: ["status"],
        where: {
          OR: [
            { status: PrescriptionStatus.PENDING },
            { status: PrescriptionStatus.CANNOT_FILL },
            { fill: { pharmacyId: pharmacy.id } },
          ],
        },
        _count: { id: true },
      }),
      prisma.prescriptionMedicine.groupBy({
        by: ["medicineId"],
        where: {
          prescription: {
            OR: [
              { status: PrescriptionStatus.PENDING },
              { status: PrescriptionStatus.CANNOT_FILL },
              { fill: { pharmacyId: pharmacy.id } },
            ],
          },
        },
        _count: { prescriptionId: true },
        orderBy: { _count: { prescriptionId: "desc" } },
        take: 10,
      }),
      prisma.$queryRaw<Array<{ bucket: Date; count: bigint }>>(Prisma.sql`
        SELECT date_trunc('day', "filledAt") AS bucket, COUNT(*)::bigint AS count
        FROM "Fill"
        WHERE "pharmacyId" = ${pharmacy.id}
          AND "filledAt" >= CURRENT_DATE - INTERVAL '29 days'
        GROUP BY 1
        ORDER BY 1 ASC
      `),
      prisma.$queryRaw<Array<{ bucket: Date; count: bigint }>>(Prisma.sql`
        SELECT date_trunc('week', "filledAt") AS bucket, COUNT(*)::bigint AS count
        FROM "Fill"
        WHERE "pharmacyId" = ${pharmacy.id}
          AND "filledAt" >= date_trunc('week', CURRENT_DATE) - INTERVAL '11 weeks'
        GROUP BY 1
        ORDER BY 1 ASC
      `),
      prisma.prescription.findMany({
        where: {
          OR: [
            { status: PrescriptionStatus.PENDING },
            { status: PrescriptionStatus.CANNOT_FILL },
            { fill: { pharmacyId: pharmacy.id } },
          ],
        },
        take: 10,
        orderBy: { updatedAt: "desc" },
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

  const totalReceived = counts.pending + counts.filled + counts.cannotFill;
  const medicines = await prisma.medicine.findMany({
    where: { id: { in: medicineGroups.map((group) => group.medicineId) } },
    select: { id: true, name: true, genericName: true },
  });
  const medicineById = new Map(medicines.map((medicine) => [medicine.id, medicine]));

  return {
    pharmacy: { id: pharmacy.id, pharmacyName: pharmacy.pharmacyName },
    summary: {
      totalPrescriptionsReceived: totalReceived,
      pendingPrescriptions: counts.pending,
      filledPrescriptions: counts.filled,
      cannotFillPrescriptions: counts.cannotFill,
      fulfillmentRate: totalReceived > 0 ? Number(((counts.filled / totalReceived) * 100).toFixed(1)) : 0,
    },
    trends: {
      dailySuccessfulFulfillment: dailyTrend.map((item) => ({ date: item.bucket, count: Number(item.count) })),
      weeklySuccessfulFulfillment: weeklyTrend.map((item) => ({ week: item.bucket, count: Number(item.count) })),
    },
    medicines: medicineGroups.map((group) => ({
      medicine: medicineById.get(group.medicineId),
      processedCount: group._count.prescriptionId,
    })),
    statusBreakdown: {
      pending: counts.pending,
      filled: counts.filled,
      cannot_fill: counts.cannotFill,
    },
    recentActivity: recentActivity.map(formatPrescription),
  };
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

export type FulfillmentAction = "FILLED" | "CANNOT_FILL";

export function isFulfillmentAction(value: unknown): value is FulfillmentAction {
  return value === "FILLED" || value === "CANNOT_FILL";
}

export interface FulfillPrescriptionInput {
  action: "FILLED" | "CANNOT_FILL" | string;
  notes?: string | null;
}

export async function fulfillPrescription(
  userId: string,
  prescriptionId: string,
  input: FulfillPrescriptionInput
) {
  // 1. Resolve active PharmacyProfile from server session
  const pharmacy = await getPharmacyOrError(userId);
  if ("error" in pharmacy) return pharmacy;

  // 2. Validate input action
  if (!input || typeof input !== "object" || !input.action) {
    return {
      error: "Action is required. Must be 'FILLED' or 'CANNOT_FILL'.",
      statusCode: 400 as const,
    };
  }

  const { action, notes } = input;
  if (action !== "FILLED" && action !== "CANNOT_FILL") {
    return {
      error: "Invalid action. Must be 'FILLED' or 'CANNOT_FILL'.",
      statusCode: 400 as const,
    };
  }

  // 3. Atomic guarded transaction
  try {
    return await prisma.$transaction(async (tx) => {
      // Check if prescription exists
      const existing = await tx.prescription.findUnique({
        where: { id: prescriptionId },
        select: { id: true, status: true },
      });

      if (!existing) {
        return { error: "Prescription not found.", statusCode: 404 as const };
      }

      // Check terminal state
      if (
        existing.status === PrescriptionStatus.FILLED ||
        existing.status === PrescriptionStatus.CANNOT_FILL
      ) {
        return {
          error: `Prescription has already been processed with terminal status '${existing.status}'.`,
          statusCode: 409 as const,
        };
      }

      if (existing.status !== PrescriptionStatus.PENDING) {
        return {
          error: `Prescription status must be 'PENDING' to be fulfilled, but current status is '${existing.status}'.`,
          statusCode: 409 as const,
        };
      }

      const fulfillmentTimestamp = new Date();

      if (action === "FILLED") {
        // Guarded atomic update: only update if status is still PENDING
        const updateResult = await tx.prescription.updateMany({
          where: {
            id: prescriptionId,
            status: PrescriptionStatus.PENDING,
          },
          data: {
            status: PrescriptionStatus.FILLED,
            filledAt: fulfillmentTimestamp,
          },
        });

        if (updateResult.count === 0) {
          const current = await tx.prescription.findUnique({
            where: { id: prescriptionId },
            select: { status: true },
          });
          return {
            error: `Prescription has already been processed with status '${current?.status ?? "UNKNOWN"}'.`,
            statusCode: 409 as const,
          };
        }

        // Create exactly one Fill record
        await tx.fill.create({
          data: {
            prescriptionId,
            pharmacyId: pharmacy.id, // Strictly server-derived from authenticated user
            filledAt: fulfillmentTimestamp,
            notes: typeof notes === "string" ? notes.trim() || null : null,
          },
        });
      } else {
        // CANNOT_FILL
        const updateResult = await tx.prescription.updateMany({
          where: {
            id: prescriptionId,
            status: PrescriptionStatus.PENDING,
          },
          data: {
            status: PrescriptionStatus.CANNOT_FILL,
          },
        });

        if (updateResult.count === 0) {
          const current = await tx.prescription.findUnique({
            where: { id: prescriptionId },
            select: { status: true },
          });
          return {
            error: `Prescription has already been processed with status '${current?.status ?? "UNKNOWN"}'.`,
            statusCode: 409 as const,
          };
        }
        // Do not create any Fill record for CANNOT_FILL
      }

      // Query updated prescription using safe pharmacy selector (diagnosis omitted)
      const updatedPrescription = await tx.prescription.findUniqueOrThrow({
        where: { id: prescriptionId },
        select: pharmacyPrescriptionSelect,
      });

      return {
        success: true,
        message:
          action === "FILLED"
            ? "Prescription successfully filled."
            : "Prescription marked as cannot fill.",
        prescription: formatPrescription(updatedPrescription),
      };
    });
  } catch (error: unknown) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return {
        error: "Prescription has already been fulfilled.",
        statusCode: 409 as const,
      };
    }
    console.error("Error fulfilling prescription in transaction:", error);
    return {
      error: "An unexpected error occurred during fulfillment.",
      statusCode: 500 as const,
    };
  }
}

export async function fulfillPharmacyPrescription(
  prescriptionId: string,
  pharmacyId: string,
  action: FulfillmentAction | string
) {
  const pharmacy = await prisma.pharmacyProfile.findUnique({
    where: { id: pharmacyId },
    select: { userId: true },
  });
  if (!pharmacy) {
    return { success: false, error: "Pharmacy profile not found.", statusCode: 404 as const };
  }
  const result = await fulfillPrescription(pharmacy.userId, prescriptionId, { action });
  if ("error" in result) {
    return { success: false, error: result.error, statusCode: result.statusCode };
  }
  return { success: true, prescription: result.prescription };
}