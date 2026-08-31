import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { authorizeRequest } from "@/lib/permissions";
import { getDoctorPrescriptionDetail } from "@/lib/doctor-service";

export const dynamic = "force-dynamic";

/**
 * GET /api/doctor/prescriptions/[id]
 * Protected endpoint returning detailed prescription record with full diagnosis
 * strictly verifying that the prescription was created by the requesting doctor.
 */
export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    // 1. Role-based authorization guard (DOCTOR only)
    const auth = await authorizeRequest({ allowedRoles: [UserRole.DOCTOR] });
    if (auth.errorResponse) {
      return auth.errorResponse;
    }

    const { user } = auth;
    const prescriptionId = params.id;

    if (!prescriptionId) {
      return NextResponse.json(
        { error: "Prescription ID is required." },
        { status: 400 }
      );
    }

    // 2. Retrieve prescription detail with author ownership check
    const result = await getDoctorPrescriptionDetail(user.id, prescriptionId);
    if ("error" in result && result.error) {
      return NextResponse.json(
        { error: result.error },
        { status: result.statusCode }
      );
    }

    return NextResponse.json(
      { prescription: result.prescription },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error retrieving doctor prescription details:", error);
    return NextResponse.json(
      { error: "Failed to retrieve prescription details." },
      { status: 500 }
    );
  }
}
