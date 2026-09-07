import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { AuthUser, authorizeRequest } from "@/lib/permissions";
import { getDoctorAnalytics } from "@/lib/doctor-service";

export async function getDoctorAnalyticsResponse(userOverride?: AuthUser | null) {
  try {
    const auth = await authorizeRequest({
      allowedRoles: [UserRole.DOCTOR],
      ...(userOverride !== undefined ? { userOverride } : {}),
    });
    if (auth.errorResponse) {
      return auth.errorResponse;
    }

    const analyticsData = await getDoctorAnalytics(auth.user.id);
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