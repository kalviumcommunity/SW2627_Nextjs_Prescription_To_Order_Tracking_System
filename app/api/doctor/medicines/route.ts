import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { authorizeRequest } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const auth = await authorizeRequest({ allowedRoles: [UserRole.DOCTOR] });
    if (auth.errorResponse) {
      return auth.errorResponse;
    }

    const medicines = await prisma.medicine.findMany({
      orderBy: [{ name: "asc" }],
      select: {
        id: true,
        name: true,
        genericName: true,
        stockStatus: true,
      },
    });

    return NextResponse.json({ medicines }, { status: 200 });
  } catch (error) {
    console.error("Error fetching medicine catalog:", error);
    return NextResponse.json(
      { error: "Failed to retrieve medicine catalog." },
      { status: 500 }
    );
  }
}
