import { UserRole } from "@prisma/client";
import { authorizeRequest } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { apiError, apiSuccess } from "@/lib/api-errors";

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

    return apiSuccess({
      platformStats: {
        totalUsers,
        totalDoctors,
        totalPatients,
        totalPharmacies,
        totalPrescriptions,
        totalFills,
      },
    });
  } catch (error) {
    return apiError(error, "Failed to retrieve administrative statistics.");
  }
}
