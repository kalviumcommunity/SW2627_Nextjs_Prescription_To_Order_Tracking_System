import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { authorizeRequest } from "@/lib/permissions";
import { getDoctorPrescriptionDetail } from "@/lib/doctor-service";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await authorizeRequest({ allowedRoles: [UserRole.DOCTOR] });
    if (auth.errorResponse) {
      return auth.errorResponse;
    }

    const result = await getDoctorPrescriptionDetail(auth.user.id, params.id);
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
    console.error("Error fetching doctor prescription detail:", error);
    return NextResponse.json(
      { error: "Failed to retrieve prescription details." },
      { status: 500 }
    );
  }
}
