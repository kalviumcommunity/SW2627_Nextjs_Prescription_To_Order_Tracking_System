import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { authorizeRequest } from "@/lib/permissions";
import { getPharmacyDashboardData } from "@/lib/pharmacy-service";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const auth = await authorizeRequest({ allowedRoles: [UserRole.PHARMACY] });
    if (auth.errorResponse) return auth.errorResponse;

    const result = await getPharmacyDashboardData(auth.user.id);
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.statusCode });
    }
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("Error fetching pharmacy dashboard:", error);
    return NextResponse.json({ error: "Failed to retrieve pharmacy dashboard metrics." }, { status: 500 });
  }
}