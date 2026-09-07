import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { AuthUser, authorizeRequest } from "@/lib/permissions";
import { getPharmacyAnalytics } from "@/lib/pharmacy-service";

export const dynamic = "force-dynamic";

export async function GET(options?: { userOverride?: AuthUser | null }) {
  try {
    const auth = await authorizeRequest({
      allowedRoles: [UserRole.PHARMACY],
      ...(options?.userOverride !== undefined ? { userOverride: options.userOverride } : {}),
    });
    if (auth.errorResponse) return auth.errorResponse;

    const result = await getPharmacyAnalytics(auth.user.id);
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.statusCode });
    }
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("Error fetching pharmacy analytics:", error);
    return NextResponse.json({ error: "Failed to retrieve pharmacy analytics." }, { status: 500 });
  }
}