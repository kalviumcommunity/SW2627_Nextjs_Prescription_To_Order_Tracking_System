import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { authorizeRequest } from "@/lib/permissions";
import { getDoctorAnalytics } from "@/lib/doctor-service";

export const dynamic = "force-dynamic";

/**
 * GET /api/doctor/analytics
 * Protected endpoint returning dynamic, derived clinical performance analytics
 * for the authenticated clinician.
 * 
 * Authorization:
 * - Requires authenticated session
 * - Requires UserRole.DOCTOR
 * - Strictly isolates records to the authenticated doctor
 */
export async function GET() {
  try {
    // 1. Role-based authorization guard (DOCTOR only)
    const auth = await authorizeRequest({ allowedRoles: [UserRole.DOCTOR] });
    if (auth.errorResponse) {
      return auth.errorResponse;
    }

    const { user } = auth;

    // 2. Compute live derived analytics for the authenticated doctor
    const analyticsData = await getDoctorAnalytics(user.id);
    if ("error" in analyticsData && analyticsData.error) {
      return NextResponse.json(
        { error: analyticsData.error },
        { status: analyticsData.statusCode }
      );
    }

    return NextResponse.json(analyticsData, { status: 200 });
  } catch (error) {
    console.error("Error fetching doctor analytics:", error);
    return NextResponse.json(
      { error: "Failed to retrieve clinical performance analytics." },
      { status: 500 }
    );
  }
}
