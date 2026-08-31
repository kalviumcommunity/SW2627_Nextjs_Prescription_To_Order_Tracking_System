import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { authorizeRequest } from "@/lib/permissions";
import {
  getDoctorPrescriptionsList,
  createDoctorPrescription,
} from "@/lib/doctor-service";

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

/**
 * POST /api/doctor/prescriptions
 * Protected endpoint allowing an authenticated clinician to create a multi-medicine prescription
 * for a patient assigned to their care roster.
 */
export async function POST(req: Request) {
  try {
    // 1. Role-based authorization guard (DOCTOR only)
    const auth = await authorizeRequest({ allowedRoles: [UserRole.DOCTOR] });
    if (auth.errorResponse) {
      return auth.errorResponse;
    }

    const { user } = auth;

    // 2. Parse request body
    let body;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON format in request body." },
        { status: 400 }
      );
    }

    // 3. Create prescription through transactional service layer
    const result = await createDoctorPrescription(user.id, body);
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
    console.error("Error creating prescription:", error);
    return NextResponse.json(
      { error: "Failed to process prescription creation." },
      { status: 500 }
    );
  }
}

