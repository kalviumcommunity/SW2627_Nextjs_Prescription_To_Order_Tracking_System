import { PrescriptionStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getDoctorProfileByUserId } from "@/lib/permissions";

/**
 * Retrieves dashboard summary metrics and recent prescriptions for an authenticated doctor.
 * All computations are performed live on the database without hardcoded values.
 */
export async function getDoctorDashboardData(userId: string) {
  const doctorProfile = await getDoctorProfileByUserId(userId);
  if (!doctorProfile) {
    return { error: "Doctor profile not found.", statusCode: 404 as const };
  }

  const doctorId = doctorProfile.id;

  // Execute parallel database aggregations filtered by doctor ownership
  const [
    totalPrescriptions,
    pendingCount,
    filledCount,
    totalPatients,
    recentPrescriptions,
  ] = await Promise.all([
    prisma.prescription.count({
      where: { doctorId },
    }),
    prisma.prescription.count({
      where: { doctorId, status: PrescriptionStatus.PENDING },
    }),
    prisma.prescription.count({
      where: { doctorId, status: PrescriptionStatus.FILLED },
    }),
    prisma.doctorPatient.count({
      where: { doctorId },
    }),
    prisma.prescription.findMany({
      where: { doctorId },
      include: {
        patient: {
          select: {
            id: true,
            name: true,
            age: true,
            gender: true,
            contactInfo: true,
          },
        },
        prescriptionMedicines: {
          include: {
            medicine: {
              select: {
                id: true,
                name: true,
                genericName: true,
                stockStatus: true,
              },
            },
          },
        },
        fill: {
          select: {
            id: true,
            filledAt: true,
            notes: true,
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
      take: 5,
    }),
  ]);

  return {
    doctor: {
      id: doctorProfile.id,
      specialization: doctorProfile.specialization,
      licenseNumber: doctorProfile.licenseNumber,
      phone: doctorProfile.phone,
    },
    stats: {
      totalPrescriptions,
      pendingCount,
      filledCount,
      totalPatients,
    },
    recentPrescriptions,
  };
}

/**
 * Retrieves the patient roster exclusively linked to the authenticated doctor.
 * Uses the DoctorPatient join relationship to prevent data leakage across clinicians.
 */
export async function getDoctorPatientsRoster(userId: string) {
  const doctorProfile = await getDoctorProfileByUserId(userId);
  if (!doctorProfile) {
    return { error: "Doctor profile not found.", statusCode: 404 as const };
  }

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
    orderBy: { createdAt: "desc" },
  });

  const patients = roster.map((item) => item.patient);

  return {
    doctor: {
      id: doctorProfile.id,
      specialization: doctorProfile.specialization,
      licenseNumber: doctorProfile.licenseNumber,
    },
    patients,
  };
}

/**
 * Retrieves all prescriptions authored by the authenticated doctor.
 * Strictly filters by doctorId at the query level.
 */
export async function getDoctorPrescriptionsList(
  userId: string,
  options?: { status?: PrescriptionStatus }
) {
  const doctorProfile = await getDoctorProfileByUserId(userId);
  if (!doctorProfile) {
    return { error: "Doctor profile not found.", statusCode: 404 as const };
  }

  const whereClause: {
    doctorId: string;
    status?: PrescriptionStatus;
  } = {
    doctorId: doctorProfile.id,
  };

  if (options?.status) {
    whereClause.status = options.status;
  }

  const prescriptions = await prisma.prescription.findMany({
    where: whereClause,
    include: {
      patient: {
        select: {
          id: true,
          name: true,
          age: true,
          gender: true,
          contactInfo: true,
        },
      },
      prescriptionMedicines: {
        include: {
          medicine: {
            select: {
              id: true,
              name: true,
              genericName: true,
              stockStatus: true,
            },
          },
        },
      },
      fill: {
        select: {
          id: true,
          filledAt: true,
          notes: true,
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

  return {
    doctor: {
      id: doctorProfile.id,
      specialization: doctorProfile.specialization,
    },
    prescriptions,
  };
}

/**
 * Retrieves full details for a single prescription authored by the authenticated doctor.
 * Strictly verifies ownership; returns 404 for missing records and 403 for other doctors' records.
 */
export async function getDoctorPrescriptionDetail(
  userId: string,
  prescriptionId: string
) {
  const doctorProfile = await getDoctorProfileByUserId(userId);
  if (!doctorProfile) {
    return { error: "Doctor profile not found.", statusCode: 404 as const };
  }

  const prescription = await prisma.prescription.findUnique({
    where: { id: prescriptionId },
    include: {
      patient: {
        select: {
          id: true,
          name: true,
          age: true,
          gender: true,
          contactInfo: true,
        },
      },
      prescriptionMedicines: {
        include: {
          medicine: {
            select: {
              id: true,
              name: true,
              genericName: true,
              stockStatus: true,
            },
          },
        },
      },
      fill: {
        select: {
          id: true,
          filledAt: true,
          notes: true,
          pharmacy: {
            select: {
              pharmacyName: true,
              phone: true,
            },
          },
        },
      },
    },
  });

  if (!prescription) {
    return { error: "Prescription not found.", statusCode: 404 as const };
  }

  // Enforce doctor ownership
  if (prescription.doctorId !== doctorProfile.id) {
    return {
      error: "Access denied. You can only access prescriptions authored by you.",
      statusCode: 403 as const,
    };
  }

  return {
    prescription,
  };
}
