import { NextResponse } from "next/server";
import { PrescriptionStatus, UserRole } from "@prisma/client";
import { authorizeRequest } from "@/lib/permissions";
import { getPharmacyPrescriptions } from "@/lib/pharmacy-service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const auth = await authorizeRequest({ allowedRoles: [UserRole.PHARMACY] });
    if (auth.errorResponse) return auth.errorResponse;

    const searchParams = new URL(request.url).searchParams;
    const hasStatus = searchParams.has("status");
    const statusValue = searchParams.get("status");
    if (hasStatus && (!statusValue || !Object.values(PrescriptionStatus).includes(statusValue as PrescriptionStatus))) {
      return NextResponse.json(
        { error: "Invalid status. Use PENDING, FILLED, or CANNOT_FILL." },
        { status: 400 }
      );
    }

    const result = await getPharmacyPrescriptions(auth.user.id, statusValue as PrescriptionStatus | undefined);
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.statusCode });
    }
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("Error fetching pharmacy prescriptions:", error);
    return NextResponse.json({ error: "Failed to retrieve pharmacy prescriptions." }, { status: 500 });
  }
}