import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { authorizeRequest, getDoctorProfileByUserId } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // 1. Role-based authorization guard (DOCTOR only)
    const auth = await authorizeRequest({ allowedRoles: [UserRole.DOCTOR] });
    if (auth.errorResponse) {
      return auth.errorResponse;
    }

    const { user } = auth;

    // 2. Fetch doctor profile
    const doctorProfile = await getDoctorProfileByUserId(user.id);
    if (!doctorProfile) {
      return NextResponse.json(
        { error: "Doctor profile not found." },
        { status: 404 }
      );
    }

    // 3. Retrieve only patients assigned to this doctor's roster
    const roster = await prisma.doctorPatient.findMany({
      where: { doctorId: doctorProfile.id },
      include: {
        patient: {
          select: {
            id: true,
            name: true,
            age: true,
            gender: true,
            contactInfo: true,
            createdAt: true,
          },
        },
      },
    });

    const patients = roster.map((item) => item.patient);

    return NextResponse.json(
      {
        doctor: {
          id: doctorProfile.id,
          specialization: doctorProfile.specialization,
          licenseNumber: doctorProfile.licenseNumber,
        },
        patients,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error fetching doctor roster:", error);
    return NextResponse.json(
      { error: "Failed to retrieve doctor roster." },
      { status: 500 }
    );
  }
}
