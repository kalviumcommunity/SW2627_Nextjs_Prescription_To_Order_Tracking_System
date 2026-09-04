import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { AuthUser, authorizeRequest } from "@/lib/permissions";
import { fulfillPrescription } from "@/lib/pharmacy-service";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
  options?: { userOverride?: AuthUser | null }
) {
  try {
    const auth = await authorizeRequest({
      allowedRoles: [UserRole.PHARMACY],
      ...(options?.userOverride !== undefined ? { userOverride: options.userOverride } : {}),
    });
    if (auth.errorResponse) return auth.errorResponse;

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { error: "Invalid request payload. Expected JSON object with action." },
        { status: 400 }
      );
    }

    const { action, notes } = body;
    const result = await fulfillPrescription(auth.user.id, params.id, { action, notes });

    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.statusCode });
    }

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("Error fulfilling pharmacy prescription:", error);
    return NextResponse.json(
      { error: "Failed to fulfill prescription." },
      { status: 500 }
    );
  }
}
