import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
<<<<<<< HEAD
import { authorizeRequest, getPharmacyProfileByUserId } from "@/lib/permissions";
import { fulfillPharmacyPrescription, FulfillmentAction, isFulfillmentAction } from "@/lib/pharmacy-service";
=======
import { AuthUser, authorizeRequest } from "@/lib/permissions";
import { fulfillPrescription } from "@/lib/pharmacy-service";
>>>>>>> 8cb84a5d07c7faeeded506a6b2a4cb078bb615a2

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
<<<<<<< HEAD
  { params }: { params: { id: string } }
) {
  try {
    const auth = await authorizeRequest({ allowedRoles: [UserRole.PHARMACY] });
    if (auth.errorResponse) {
      return auth.errorResponse;
    }

    const pharmacyProfile = await getPharmacyProfileByUserId(auth.user.id);
    if (!pharmacyProfile) {
      return NextResponse.json({ error: "Pharmacy profile not found." }, { status: 404 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
    }

    const action = (body as { action?: unknown })?.action;
    if (!isFulfillmentAction(action)) {
      return NextResponse.json(
        { error: "Action must be FILLED or CANNOT_FILL." },
=======
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
>>>>>>> 8cb84a5d07c7faeeded506a6b2a4cb078bb615a2
        { status: 400 }
      );
    }

<<<<<<< HEAD
    const result = await fulfillPharmacyPrescription(
      params.id,
      pharmacyProfile.id,
      action as FulfillmentAction
    );

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: result.statusCode });
    }

    return NextResponse.json({ prescription: result.prescription }, { status: 200 });
=======
    const { action, notes } = body;
    const result = await fulfillPrescription(auth.user.id, params.id, { action, notes });

    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.statusCode });
    }

    return NextResponse.json(result, { status: 200 });
>>>>>>> 8cb84a5d07c7faeeded506a6b2a4cb078bb615a2
  } catch (error) {
    console.error("Error fulfilling pharmacy prescription:", error);
    return NextResponse.json(
      { error: "Failed to fulfill prescription." },
      { status: 500 }
    );
  }
<<<<<<< HEAD
}
=======
}
>>>>>>> 8cb84a5d07c7faeeded506a6b2a4cb078bb615a2
