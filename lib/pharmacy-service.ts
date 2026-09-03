import { Prisma, PrescriptionStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type FulfillmentAction = "FILLED" | "CANNOT_FILL";

export function isFulfillmentAction(value: unknown): value is FulfillmentAction {
  return value === "FILLED" || value === "CANNOT_FILL";
}

type FulfillmentResult =
  | { success: true; prescription: Record<string, unknown> }
  | { success: false; error: string; statusCode: 404 | 409 };

const pharmacyPrescriptionSelect = {
  id: true,
  status: true,
  filledAt: true,
  createdAt: true,
  updatedAt: true,
  documentRef: true,
  patient: {
    select: {
      id: true,
      name: true,
      contactInfo: true,
    },
  },
  prescriptionMedicines: {
    include: {
      medicine: {
        select: {
          id: true,
          name: true,
          genericName: true,
        },
      },
    },
  },
  fill: {
    select: {
      id: true,
      pharmacyId: true,
      filledAt: true,
    },
  },
} satisfies Prisma.PrescriptionSelect;

export async function fulfillPharmacyPrescription(
  prescriptionId: string,
  pharmacyId: string,
  action: FulfillmentAction
): Promise<FulfillmentResult> {
  try {
    const prescription = await prisma.$transaction(async (transaction) => {
      const update = await transaction.prescription.updateMany({
        where: {
          id: prescriptionId,
          status: PrescriptionStatus.PENDING,
        },
        data:
          action === "FILLED"
            ? { status: PrescriptionStatus.FILLED, filledAt: new Date() }
            : { status: PrescriptionStatus.CANNOT_FILL },
      });

      if (update.count !== 1) {
        const existing = await transaction.prescription.findUnique({
          where: { id: prescriptionId },
          select: { id: true },
        });

        throw new FulfillmentConflict(existing ? "Prescription has already been processed." : "Prescription not found.");
      }

      if (action === "FILLED") {
        await transaction.fill.create({
          data: {
            prescriptionId,
            pharmacyId,
          },
        });
      }

      return transaction.prescription.findUniqueOrThrow({
        where: { id: prescriptionId },
        select: pharmacyPrescriptionSelect,
      });
    });

    return { success: true, prescription: prescription as Record<string, unknown> };
  } catch (error) {
    if (error instanceof FulfillmentConflict) {
      return { success: false, error: error.message, statusCode: error.message === "Prescription not found." ? 404 : 409 };
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { success: false, error: "Prescription has already been filled.", statusCode: 409 };
    }

    throw error;
  }
}

class FulfillmentConflict extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FulfillmentConflict";
  }
}