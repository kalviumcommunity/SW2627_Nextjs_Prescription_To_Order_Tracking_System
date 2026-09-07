import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { authorizeRequest, getPharmacyProfileByUserId } from "@/lib/permissions";
import { fulfillPharmacyPrescription, FulfillmentAction, isFulfillmentAction } from "@/lib/pharmacy-service";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
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
        { status: 400 }
      );
    }

    const result = await fulfillPharmacyPrescription(
      params.id,
      pharmacyProfile.id,
      action as FulfillmentAction
    );

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: result.statusCode });
    }

    return NextResponse.json({ prescription: result.prescription }, { status: 200 });
  } catch (error) {
    console.error("Error fulfilling pharmacy prescription:", error);
    return NextResponse.json(
      { error: "Failed to fulfill prescription." },
      { status: 500 }
    );
  }
}