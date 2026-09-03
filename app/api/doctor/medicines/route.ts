import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { authorizeRequest } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

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

    return NextResponse.json({ medicines }, { status: 200 });
  } catch (error) {
    console.error("Error fetching medicines:", error);
    return NextResponse.json(
      { error: "Failed to retrieve medicines catalog." },
      { status: 500 }
    );
  }
}
