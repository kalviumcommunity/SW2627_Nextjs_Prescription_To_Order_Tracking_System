import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { authorizeRequest } from "@/lib/permissions";
import { getDoctorDashboardData } from "@/lib/doctor-service";

export const dynamic = "force-dynamic";

/**
 * GET /api/doctor/dashboard
 * Protected endpoint returning real-time dashboard summary metrics and recent prescriptions
 * for the authenticated clinician.
 */
export async function GET() {
  try {
    // 1. Role-based authorization guard (DOCTOR only)
    const auth = await authorizeRequest({ allowedRoles: [UserRole.DOCTOR] });
    if (auth.errorResponse) {
      return auth.errorResponse;
    }

    const { user } = auth;

    // 2. Fetch live metrics and recent items filtered by doctor ownership
    const dashboardData = await getDoctorDashboardData(user.id);
    if ("error" in dashboardData && dashboardData.error) {
      return NextResponse.json(
        { error: dashboardData.error },
        { status: dashboardData.statusCode }
      );
    }

    return NextResponse.json(dashboardData, { status: 200 });
  } catch (error) {
    console.error("Error fetching doctor dashboard:", error);
    return NextResponse.json(
      { error: "Failed to retrieve doctor dashboard metrics." },
      { status: 500 }
    );
  }
}
