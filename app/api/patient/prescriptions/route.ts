<<<<<<< HEAD
import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { authorizeRequest, getPatientProfileByUserId } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // 1. Role-based authorization guard (PATIENT only)
    const auth = await authorizeRequest({ allowedRoles: [UserRole.PATIENT] });
    if (auth.errorResponse) {
      return auth.errorResponse;
    }

    const { user } = auth;

    // 2. Fetch patient profile
    const patientProfile = await getPatientProfileByUserId(user.id);
    if (!patientProfile) {
      return NextResponse.json(
        { error: "Patient profile not found." },
        { status: 404 }
      );
    }

    // 3. Fetch only prescriptions belonging to this patient
    const prescriptions = await prisma.prescription.findMany({
      where: { patientId: patientProfile.id },
      include: {
        doctor: {
          select: {
            id: true,
            specialization: true,
            phone: true,
            user: {
              select: {
                email: true,
              },
            },
          },
        },
        prescriptionMedicines: {
          include: {
            medicine: {
              select: {
                id: true,
                name: true,
                genericName: true,
              },
            },
          },
        },
        fill: {
          select: {
            id: true,
            filledAt: true,
            pharmacy: {
              select: {
                pharmacyName: true,
                phone: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(
      {
        patient: {
          id: patientProfile.id,
          name: patientProfile.name,
        },
        prescriptions,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error fetching patient prescriptions:", error);
    return NextResponse.json(
      { error: "Failed to retrieve prescriptions." },
      { status: 500 }
    );
  }
=======
import { getPatientPrescriptionsResponse } from "@/lib/patient-service";

export const dynamic = "force-dynamic";

/**
 * GET /api/patient/prescriptions
 * Returns prescriptions belonging strictly to the authenticated patient, including
 * prescription ID, formatted doctor name, creation timestamp, diagnosis, document reference, and status.
 */
export async function GET() {
  return getPatientPrescriptionsResponse();
>>>>>>> 8cb84a5d07c7faeeded506a6b2a4cb078bb615a2
}
