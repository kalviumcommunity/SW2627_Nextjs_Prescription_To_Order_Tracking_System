import { NextResponse } from "next/server";
import { UserRole, PrescriptionStatus } from "@prisma/client";
import { authorizeRequest, getPharmacyProfileByUserId, sanitizePrescriptionForPharmacy } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // 1. Role-based authorization guard (PHARMACY only)
    const auth = await authorizeRequest({ allowedRoles: [UserRole.PHARMACY] });
    if (auth.errorResponse) {
      return auth.errorResponse;
    }

    const { user } = auth;

    // 2. Fetch pharmacy profile
    const pharmacyProfile = await getPharmacyProfileByUserId(user.id);
    if (!pharmacyProfile) {
      return NextResponse.json(
        { error: "Pharmacy profile not found." },
        { status: 404 }
      );
    }

    // 3. Fetch pending prescriptions for fulfillment queue
    const prescriptions = await prisma.prescription.findMany({
      where: { status: PrescriptionStatus.PENDING },
      include: {
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
      },
      orderBy: { createdAt: "asc" },
    });

    // 4. Sanitize prescriptions - strictly remove diagnosis for pharmacy privacy
    const sanitizedQueue = prescriptions.map((rx) => sanitizePrescriptionForPharmacy(rx));

    return NextResponse.json(
      {
        pharmacy: {
          id: pharmacyProfile.id,
          pharmacyName: pharmacyProfile.pharmacyName,
        },
        queue: sanitizedQueue,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error fetching pharmacy queue:", error);
    return NextResponse.json(
      { error: "Failed to retrieve fulfillment queue." },
      { status: 500 }
    );
  }
}
