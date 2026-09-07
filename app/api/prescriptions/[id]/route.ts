import { NextResponse } from "next/server";
import { authorizeRequest, canUserAccessPrescription } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    // 1. Enforce authentication
    const auth = await authorizeRequest();
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

    // 2. Enforce granular resource ownership & access permissions
    const accessCheck = await canUserAccessPrescription(user, prescriptionId);

    if (!accessCheck.allowed) {
      if (accessCheck.reason === "Prescription not found.") {
        return NextResponse.json(
          { error: "Prescription not found." },
          { status: 404 }
        );
      }

      return NextResponse.json(
        { error: accessCheck.reason || "Forbidden. Access to this prescription is denied." },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { prescription: accessCheck.prescription },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error retrieving prescription:", error);
    return NextResponse.json(
      { error: "Failed to retrieve prescription." },
      { status: 500 }
    );
  }
}
