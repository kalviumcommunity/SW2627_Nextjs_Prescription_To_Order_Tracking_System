import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { authorizeRequest } from "@/lib/permissions";
import { getDoctorPrescriptionsList } from "@/lib/doctor-service";

export const dynamic = "force-dynamic";

/**
 * GET /api/doctor/prescriptions
 * Protected endpoint returning all prescriptions authored by the authenticated doctor.
 */
export async function GET() {
  try {
    // 1. Role-based authorization guard (DOCTOR only)
    const auth = await authorizeRequest({ allowedRoles: [UserRole.DOCTOR] });
    if (auth.errorResponse) {
      return auth.errorResponse;
    }

    const { user } = auth;

    // 2. Fetch prescriptions authored by this doctor
    const prescriptionsData = await getDoctorPrescriptionsList(user.id);
    if ("error" in prescriptionsData && prescriptionsData.error) {
      return NextResponse.json(
        { error: prescriptionsData.error },
        { status: prescriptionsData.statusCode }
      );
    }

    return NextResponse.json(prescriptionsData, { status: 200 });
  } catch (error) {
    console.error("Error fetching doctor prescriptions:", error);
    return NextResponse.json(
      { error: "Failed to retrieve doctor prescriptions." },
      { status: 500 }
    );
  }
}
