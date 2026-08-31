import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { authorizeRequest } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // 1. Role-based authorization guard (ADMIN only)
    const auth = await authorizeRequest({ allowedRoles: [UserRole.ADMIN] });
    if (auth.errorResponse) {
      return auth.errorResponse;
    }

    // 2. Fetch platform overview counts
    const [
      totalUsers,
      totalDoctors,
      totalPatients,
      totalPharmacies,
      totalPrescriptions,
      totalFills,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.doctorProfile.count(),
      prisma.patientProfile.count(),
      prisma.pharmacyProfile.count(),
      prisma.prescription.count(),
      prisma.fill.count(),
    ]);

    return NextResponse.json(
      {
        platformStats: {
          totalUsers,
          totalDoctors,
          totalPatients,
          totalPharmacies,
          totalPrescriptions,
          totalFills,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error fetching admin stats:", error);
    return NextResponse.json(
      { error: "Failed to retrieve administrative statistics." },
      { status: 500 }
    );
  }
}
