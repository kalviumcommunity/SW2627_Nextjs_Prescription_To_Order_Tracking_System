import { PrescriptionStatus, UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  AuthUser,
  authorizeRequest,
  getPatientProfileByUserId,
} from "@/lib/permissions";
import { formatDoctorDisplayName } from "@/lib/doctor-service";
import { apiError, apiSuccess, errorFromResult, validationError } from "@/lib/api-errors";

/**
 * Generates clear, non-speculative tracking descriptions for prescription fulfillment states.
 * For CANNOT_FILL, communicates the unavailable/failed state without inventing non-existent database fields.
 */
export function getPrescriptionTrackingMessage(status: PrescriptionStatus): string {
  switch (status) {
    case PrescriptionStatus.PENDING:
      return "Prescription has been received and is currently awaiting pharmacy processing and fulfillment.";
    case PrescriptionStatus.FILLED:
      return "Prescription has been successfully verified, prepared, and dispensed by the pharmacy.";
    case PrescriptionStatus.CANNOT_FILL:
      return "Prescription cannot be fulfilled by the pharmacy at this time due to unavailable medication or fulfillment constraints. Please contact your prescribing clinician.";
    default:
      return "Prescription status unknown.";
  }
}

/**
 * Retrieves live database metrics and recent prescription activity for an authenticated patient.
 */
export async function getPatientDashboardData(userId: string) {
  const patientProfile = await getPatientProfileByUserId(userId);
  if (!patientProfile) {
    return { error: "Patient profile not found.", statusCode: 404 as const };
  }

  const patientId = patientProfile.id;

  // Execute parallel queries derived strictly from live database records
  const [
    totalPrescriptions,
    pendingPrescriptions,
    filledPrescriptions,
    cannotFillPrescriptions,
    recentPrescriptionsRaw,
  ] = await Promise.all([
    prisma.prescription.count({ where: { patientId } }),
    prisma.prescription.count({
      where: { patientId, status: PrescriptionStatus.PENDING },
    }),
    prisma.prescription.count({
      where: { patientId, status: PrescriptionStatus.FILLED },
    }),
    prisma.prescription.count({
      where: { patientId, status: PrescriptionStatus.CANNOT_FILL },
    }),
    prisma.prescription.findMany({
      where: { patientId },
      include: {
        doctor: {
          select: {
            id: true,
            specialization: true,
            licenseNumber: true,
            phone: true,
            user: {
              select: { email: true },
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
                id: true,
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

  const recentPrescriptions = recentPrescriptionsRaw.map((rx) => {
    const doctorName = formatDoctorDisplayName(rx.doctor?.user?.email);
    return {
      id: rx.id,
      doctorId: rx.doctorId,
      doctorName,
      doctor: rx.doctor
        ? {
            id: rx.doctor.id,
            name: doctorName,
            specialization: rx.doctor.specialization,
            phone: rx.doctor.phone,
          }
        : null,
      diagnosis: rx.diagnosis,
      documentRef: rx.documentRef,
      status: rx.status,
      createdAt: rx.createdAt,
      filledAt: rx.filledAt || rx.fill?.filledAt || null,
      medicines: rx.prescriptionMedicines.map((pm) => ({
        id: pm.id,
        dosage: pm.dosage,
        frequency: pm.frequency,
        duration: pm.duration,
        medicine: pm.medicine,
      })),
      fill: rx.fill,
    };
  });

  return {
    patient: {
      id: patientProfile.id,
      name: patientProfile.name,
      age: patientProfile.age,
      gender: patientProfile.gender,
      contactInfo: patientProfile.contactInfo,
    },
    activePrescriptions: pendingPrescriptions,
    pendingPrescriptions,
    filledPrescriptions,
    cannotFillPrescriptions,
    totalPrescriptions,
    stats: {
      activePrescriptions: pendingPrescriptions,
      pendingPrescriptions,
      filledPrescriptions,
      cannotFillPrescriptions,
      totalPrescriptions,
    },
    recentActivity: recentPrescriptions,
    recentPrescriptions,
  };
}

/**
 * Retrieves prescriptions belonging ONLY to the authenticated patient.
 * Includes prescription ID, formatted doctor name, createdAt, and status.
 */
export async function getPatientPrescriptionsList(userId: string) {
  const patientProfile = await getPatientProfileByUserId(userId);
  if (!patientProfile) {
    return { error: "Patient profile not found.", statusCode: 404 as const };
  }

  const prescriptions = await prisma.prescription.findMany({
    where: { patientId: patientProfile.id },
    include: {
      doctor: {
        select: {
          id: true,
          specialization: true,
          licenseNumber: true,
          phone: true,
          user: {
            select: { email: true },
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
              id: true,
              pharmacyName: true,
              phone: true,
            },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const formattedPrescriptions = prescriptions.map((rx) => {
    const doctorName = formatDoctorDisplayName(rx.doctor?.user?.email);
    return {
      id: rx.id,
      doctorId: rx.doctorId,
      doctorName,
      doctor: rx.doctor
        ? {
            id: rx.doctor.id,
            name: doctorName,
            specialization: rx.doctor.specialization,
            phone: rx.doctor.phone,
          }
        : null,
      diagnosis: rx.diagnosis,
      documentRef: rx.documentRef,
      status: rx.status,
      createdAt: rx.createdAt,
      filledAt: rx.filledAt || rx.fill?.filledAt || null,
      prescriptionMedicines: rx.prescriptionMedicines,
      medicines: rx.prescriptionMedicines.map((pm) => ({
        id: pm.id,
        dosage: pm.dosage,
        frequency: pm.frequency,
        duration: pm.duration,
        medicine: pm.medicine,
      })),
      fill: rx.fill,
    };
  });

  return {
    patient: {
      id: patientProfile.id,
      name: patientProfile.name,
    },
    prescriptions: formattedPrescriptions,
  };
}

/**
 * Retrieves patient-permitted prescription detail data for a single prescription.
 * CRITICAL OWNERSHIP RULE: The authenticated patient's profile ID is part of the query condition.
 * Querying another patient's prescription returns a safe 404 (Not Found).
 */
export async function getPatientPrescriptionDetail(
  userId: string,
  prescriptionId: string
) {
  const patientProfile = await getPatientProfileByUserId(userId);
  if (!patientProfile) {
    return { error: "Patient profile not found.", statusCode: 404 as const };
  }

  // Enforce ownership directly in query condition to avoid leaking existence of IDs across patients
  const prescription = await prisma.prescription.findFirst({
    where: {
      id: prescriptionId,
      patientId: patientProfile.id,
    },
    include: {
      doctor: {
        select: {
          id: true,
          specialization: true,
          licenseNumber: true,
          phone: true,
          user: {
            select: { email: true },
          },
        },
      },
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
              id: true,
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

  const doctorName = formatDoctorDisplayName(prescription.doctor?.user?.email);
  const trackingMessage = getPrescriptionTrackingMessage(prescription.status);

  return {
    prescription: {
      id: prescription.id,
      doctorId: prescription.doctorId,
      doctorName,
      doctor: prescription.doctor
        ? {
            id: prescription.doctor.id,
            name: doctorName,
            specialization: prescription.doctor.specialization,
            licenseNumber: prescription.doctor.licenseNumber,
            phone: prescription.doctor.phone,
            email: prescription.doctor.user?.email || null,
          }
        : null,
      patientId: prescription.patientId,
      patient: prescription.patient,
      diagnosis: prescription.diagnosis,
      documentRef: prescription.documentRef,
      status: prescription.status,
      createdAt: prescription.createdAt,
      filledAt: prescription.filledAt || prescription.fill?.filledAt || null,
      prescriptionMedicines: prescription.prescriptionMedicines,
      medicines: prescription.prescriptionMedicines.map((pm) => ({
        id: pm.id,
        dosage: pm.dosage,
        frequency: pm.frequency,
        duration: pm.duration,
        medicine: pm.medicine,
      })),
      fill: prescription.fill,
      tracking: {
        status: prescription.status,
        createdAt: prescription.createdAt,
        filledAt: prescription.filledAt || prescription.fill?.filledAt || null,
        message: trackingMessage,
        isPending: prescription.status === PrescriptionStatus.PENDING,
        isFilled: prescription.status === PrescriptionStatus.FILLED,
        isCannotFill: prescription.status === PrescriptionStatus.CANNOT_FILL,
        pharmacy: prescription.fill?.pharmacy?.pharmacyName || null,
      },
    },
  };
}

/**
 * Retrieves explicit order tracking status for an authenticated patient's prescription.
 * CRITICAL OWNERSHIP RULE: The authenticated patient's profile ID is part of the query condition.
 */
export async function getPatientPrescriptionTracking(
  userId: string,
  prescriptionId: string
) {
  const patientProfile = await getPatientProfileByUserId(userId);
  if (!patientProfile) {
    return { error: "Patient profile not found.", statusCode: 404 as const };
  }

  const prescription = await prisma.prescription.findFirst({
    where: {
      id: prescriptionId,
      patientId: patientProfile.id,
    },
    include: {
      doctor: {
        select: {
          id: true,
          specialization: true,
          phone: true,
          user: {
            select: { email: true },
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

  const doctorName = formatDoctorDisplayName(prescription.doctor?.user?.email);
  const trackingMessage = getPrescriptionTrackingMessage(prescription.status);

  return {
    tracking: {
      prescriptionId: prescription.id,
      status: prescription.status,
      createdAt: prescription.createdAt,
      filledAt: prescription.filledAt || prescription.fill?.filledAt || null,
      doctor: {
        id: prescription.doctor?.id,
        name: doctorName,
        specialization: prescription.doctor?.specialization,
      },
      medicines: prescription.prescriptionMedicines.map((pm) => ({
        id: pm.id,
        name: pm.medicine.name,
        dosage: pm.dosage,
        frequency: pm.frequency,
        duration: pm.duration,
      })),
      state: {
        code: prescription.status,
        description: trackingMessage,
        isPending: prescription.status === PrescriptionStatus.PENDING,
        isFilled: prescription.status === PrescriptionStatus.FILLED,
        isCannotFill: prescription.status === PrescriptionStatus.CANNOT_FILL,
      },
      fulfillment: prescription.fill
        ? {
            pharmacyName: prescription.fill.pharmacy.pharmacyName,
            filledAt: prescription.fill.filledAt,
            notes: prescription.fill.notes,
          }
        : null,
    },
  };
}

// -----------------------------------------------------------------------------
// ROUTE RESPONSE WRAPPERS (With userOverride for automated test execution)
// -----------------------------------------------------------------------------

export async function getPatientDashboardResponse(userOverride?: AuthUser | null) {
  try {
    const auth = await authorizeRequest({
      allowedRoles: [UserRole.PATIENT],
      ...(userOverride !== undefined ? { userOverride } : {}),
    });
    if (auth.errorResponse) {
      return auth.errorResponse;
    }

    const data = await getPatientDashboardData(auth.user.id);
    if ("error" in data && data.error) {
      return apiError(errorFromResult(data));
    }

    return apiSuccess(data);
  } catch (error) {
    return apiError(error, "Failed to retrieve patient dashboard.");
  }
}

export async function getPatientPrescriptionsResponse(userOverride?: AuthUser | null) {
  try {
    const auth = await authorizeRequest({
      allowedRoles: [UserRole.PATIENT],
      ...(userOverride !== undefined ? { userOverride } : {}),
    });
    if (auth.errorResponse) {
      return auth.errorResponse;
    }

    const data = await getPatientPrescriptionsList(auth.user.id);
    if ("error" in data && data.error) {
      return apiError(errorFromResult(data));
    }

    return apiSuccess(data);
  } catch (error) {
    return apiError(error, "Failed to retrieve prescriptions.");
  }
}

export async function getPatientPrescriptionDetailResponse(
  prescriptionId: string,
  userOverride?: AuthUser | null
) {
  try {
    const auth = await authorizeRequest({
      allowedRoles: [UserRole.PATIENT],
      ...(userOverride !== undefined ? { userOverride } : {}),
    });
    if (auth.errorResponse) {
      return auth.errorResponse;
    }

    if (!prescriptionId) {
      return apiError(validationError("Prescription ID is required."));
    }

    const data = await getPatientPrescriptionDetail(auth.user.id, prescriptionId);
    if ("error" in data && data.error) {
      return apiError(errorFromResult(data));
    }

    return apiSuccess(data);
  } catch (error) {
    return apiError(error, "Failed to retrieve prescription details.");
  }
}

export async function getPatientPrescriptionTrackingResponse(
  prescriptionId: string,
  userOverride?: AuthUser | null
) {
  try {
    const auth = await authorizeRequest({
      allowedRoles: [UserRole.PATIENT],
      ...(userOverride !== undefined ? { userOverride } : {}),
    });
    if (auth.errorResponse) {
      return auth.errorResponse;
    }

    if (!prescriptionId) {
      return apiError(validationError("Prescription ID is required."));
    }

    const data = await getPatientPrescriptionTracking(auth.user.id, prescriptionId);
    if ("error" in data && data.error) {
      return apiError(errorFromResult(data));
    }

    return apiSuccess(data);
  } catch (error) {
    return apiError(error, "Failed to retrieve prescription tracking.");
  }
}
