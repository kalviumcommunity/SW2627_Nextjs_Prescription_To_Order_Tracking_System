import { UserRole } from "@prisma/client";
import { authorizeRequest, getDoctorProfileByUserId } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { apiError, apiSuccess, notFoundError } from "@/lib/api-errors";

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
      return apiError(notFoundError("Doctor profile not found."));
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

    return apiSuccess({
      doctor: {
        id: doctorProfile.id,
        specialization: doctorProfile.specialization,
        licenseNumber: doctorProfile.licenseNumber,
      },
      patients,
    });
  } catch (error) {
    return apiError(error, "Failed to retrieve doctor roster.");
  }
}
