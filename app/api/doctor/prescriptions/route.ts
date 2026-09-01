import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { authorizeRequest } from "@/lib/permissions";
import { createDoctorPrescription, getDoctorPrescriptionsList } from "@/lib/doctor-service";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const auth = await authorizeRequest({ allowedRoles: [UserRole.DOCTOR] });
    if (auth.errorResponse) {
      return auth.errorResponse;
    }

    const result = await getDoctorPrescriptionsList(auth.user.id);
    if ("error" in result && result.error) {
      return NextResponse.json({ error: result.error }, { status: result.statusCode });
    }

    return NextResponse.json({
      doctor: result.doctor,
      prescriptions: result.prescriptions,
    });
  } catch (error) {
    console.error("Error fetching doctor prescriptions:", error);
    return NextResponse.json(
      { error: "Failed to retrieve prescriptions." },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const auth = await authorizeRequest({ allowedRoles: [UserRole.DOCTOR] });
    if (auth.errorResponse) {
      return auth.errorResponse;
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { error: "Invalid request payload." },
        { status: 400 }
      );
    }

    const result = await createDoctorPrescription(auth.user.id, {
      patientId: body.patientId,
      diagnosis: body.diagnosis,
      documentRef: body.documentRef ?? null,
      medicines: Array.isArray(body.medicines) ? body.medicines : [],
    });

    if ("error" in result && result.error) {
      return NextResponse.json(
        { error: result.error },
        { status: result.statusCode }
      );
    }

    return NextResponse.json(
      { prescription: result.prescription },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating doctor prescription:", error);
    return NextResponse.json(
      { error: "Failed to create prescription." },
      { status: 500 }
    );
  }
}
