import { UserRole } from "@prisma/client";
import { authorizeRequest } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { apiError, apiSuccess } from "@/lib/api-errors";

export const dynamic = "force-dynamic";

/**
 * GET /api/doctor/medicines
 * Protected endpoint returning the catalog of available medicines for doctors to prescribe.
 */
export async function GET() {
  try {
    // 1. Role-based authorization guard (DOCTOR only)
    const auth = await authorizeRequest({ allowedRoles: [UserRole.DOCTOR] });
    if (auth.errorResponse) {
      return auth.errorResponse;
    }

    // 2. Fetch all medicines in catalog
    const medicines = await prisma.medicine.findMany({
      select: {
        id: true,
        name: true,
        genericName: true,
        stockStatus: true,
      },
      orderBy: { name: "asc" },
    });

    return apiSuccess({ medicines });
  } catch (error) {
    return apiError(error, "Failed to retrieve medicines catalog.");
  }
}
