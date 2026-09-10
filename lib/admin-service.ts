import { PrescriptionStatus, UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AuthUser, authorizeRequest } from "@/lib/permissions";
import { formatDoctorDisplayName } from "@/lib/doctor-service";
import { apiError, apiSuccess, errorFromResult, validationError } from "@/lib/api-errors";

/**
 * Calculates a safe fulfillment rate percentage rounded to 1 decimal place.
 * Safely returns 0 when denominator is zero to prevent NaN or division-by-zero.
 */
export function calculateFulfillmentRate(numerator: number, denominator: number): number {
  if (!denominator || denominator <= 0) {
    return 0;
  }
  return Number(((numerator / denominator) * 100).toFixed(1));
}

// -----------------------------------------------------------------------------
// 1. ADMIN DASHBOARD METRICS
// -----------------------------------------------------------------------------

export async function getAdminDashboardData() {
  const [
    totalDoctors,
    totalPatients,
    pharmacyProfile,
    totalPrescriptions,
    statusGroups,
  ] = await Promise.all([
    prisma.doctorProfile.count(),
    prisma.patientProfile.count(),
    prisma.pharmacyProfile.findFirst({
      select: {
        id: true,
        pharmacyName: true,
        pharmacyType: true,
        licenseNumber: true,
        phone: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            email: true,
          },
        },
      },
    }),
    prisma.prescription.count(),
    prisma.prescription.groupBy({
      by: ["status"],
      _count: { id: true },
    }),
  ]);

  let filledPrescriptions = 0;
  let pendingPrescriptions = 0;
  let cannotFillPrescriptions = 0;

  for (const group of statusGroups) {
    if (group.status === PrescriptionStatus.FILLED) {
      filledPrescriptions = group._count.id;
    } else if (group.status === PrescriptionStatus.PENDING) {
      pendingPrescriptions = group._count.id;
    } else if (group.status === PrescriptionStatus.CANNOT_FILL) {
      cannotFillPrescriptions = group._count.id;
    }
  }

  const overallFulfillmentRate = calculateFulfillmentRate(filledPrescriptions, totalPrescriptions);
  const pharmacyAccountStatus = pharmacyProfile ? "ACTIVE" : "NOT_CONFIGURED";

  const statusBreakdown = [
    {
      status: PrescriptionStatus.PENDING,
      count: pendingPrescriptions,
      percentage: calculateFulfillmentRate(pendingPrescriptions, totalPrescriptions),
    },
    {
      status: PrescriptionStatus.FILLED,
      count: filledPrescriptions,
      percentage: overallFulfillmentRate,
    },
    {
      status: PrescriptionStatus.CANNOT_FILL,
      count: cannotFillPrescriptions,
      percentage: calculateFulfillmentRate(cannotFillPrescriptions, totalPrescriptions),
    },
  ];

  return {
    totalDoctors,
    pharmacyAccountStatus,
    totalPatients,
    totalPrescriptions,
    filledPrescriptions,
    pendingPrescriptions,
    cannotFillPrescriptions,
    overallFulfillmentRate,
    // Alternative property alias for compatibility
    fulfillmentRate: overallFulfillmentRate,
    pharmacy: pharmacyProfile
      ? {
          id: pharmacyProfile.id,
          pharmacyName: pharmacyProfile.pharmacyName,
          pharmacyType: pharmacyProfile.pharmacyType,
          licenseNumber: pharmacyProfile.licenseNumber,
          phone: pharmacyProfile.phone,
          accountStatus: pharmacyAccountStatus,
          email: pharmacyProfile.user.email,
        }
      : null,
    statusBreakdown,
    summary: {
      totalDoctors,
      pharmacyAccountStatus,
      totalPatients,
      totalPrescriptions,
      filledPrescriptions,
      pendingPrescriptions,
      cannotFillPrescriptions,
      overallFulfillmentRate,
    },
  };
}

// -----------------------------------------------------------------------------
// 2. ADMIN DOCTORS DIRECTORY
// -----------------------------------------------------------------------------

export async function getAdminDoctorsList() {
  const doctors = await prisma.doctorProfile.findMany({
    select: {
      id: true,
      userId: true,
      specialization: true,
      licenseNumber: true,
      phone: true,
      createdAt: true,
      updatedAt: true,
      user: {
        select: {
          id: true,
          email: true,
          createdAt: true,
        },
      },
      _count: {
        select: {
          prescriptions: true,
          doctorPatients: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return {
    doctors: doctors.map((doc) => ({
      id: doc.id,
      userId: doc.userId,
      name: formatDoctorDisplayName(doc.user.email),
      email: doc.user.email,
      specialization: doc.specialization,
      licenseNumber: doc.licenseNumber,
      phone: doc.phone,
      totalPrescriptions: doc._count.prescriptions,
      assignedPatientsCount: doc._count.doctorPatients,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    })),
  };
}

// -----------------------------------------------------------------------------
// 3. ADMIN PHARMACY INFORMATION (Single Pre-Provisioned Pharmacy)
// -----------------------------------------------------------------------------

export async function getAdminPharmacyInfo() {
  const pharmacy = await prisma.pharmacyProfile.findFirst({
    select: {
      id: true,
      userId: true,
      pharmacyName: true,
      pharmacyType: true,
      licenseNumber: true,
      phone: true,
      createdAt: true,
      updatedAt: true,
      user: {
        select: {
          id: true,
          email: true,
          createdAt: true,
        },
      },
      _count: {
        select: {
          fills: true,
        },
      },
    },
  });

  if (!pharmacy) {
    return {
      pharmacy: null,
      accountStatus: "NOT_CONFIGURED",
      message: "No pre-provisioned pharmacy account found.",
    };
  }

  const pharmacyData = {
    id: pharmacy.id,
    userId: pharmacy.userId,
    pharmacyName: pharmacy.pharmacyName,
    pharmacyType: pharmacy.pharmacyType,
    licenseNumber: pharmacy.licenseNumber,
    phone: pharmacy.phone,
    accountStatus: "ACTIVE",
    email: pharmacy.user.email,
    totalFills: pharmacy._count.fills,
    createdAt: pharmacy.createdAt,
    updatedAt: pharmacy.updatedAt,
  };

  return {
    pharmacy: pharmacyData,
    // Top-level aliases for direct access convenience
    pharmacyName: pharmacy.pharmacyName,
    pharmacyType: pharmacy.pharmacyType,
    licenseNumber: pharmacy.licenseNumber,
    phone: pharmacy.phone,
    accountStatus: "ACTIVE",
    email: pharmacy.user.email,
    createdAt: pharmacy.createdAt,
    updatedAt: pharmacy.updatedAt,
  };
}

// -----------------------------------------------------------------------------
// 4. ADMIN PLATFORM PRESCRIPTIONS LIST
// -----------------------------------------------------------------------------

export async function getAdminPrescriptionsList(options?: { status?: PrescriptionStatus }) {
  const whereClause = options?.status ? { status: options.status } : undefined;

  const prescriptions = await prisma.prescription.findMany({
    where: whereClause,
    select: {
      id: true,
      status: true,
      createdAt: true,
      filledAt: true,
      doctor: {
        select: {
          id: true,
          specialization: true,
          licenseNumber: true,
          phone: true,
          user: {
            select: {
              email: true,
            },
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
      fill: {
        select: {
          id: true,
          filledAt: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return {
    prescriptions: prescriptions.map((rx) => {
      const doctorName = formatDoctorDisplayName(rx.doctor?.user?.email);
      return {
        id: rx.id,
        prescriptionId: rx.id,
        status: rx.status,
        createdAt: rx.createdAt,
        filledAt: rx.filledAt || rx.fill?.filledAt || null,
        doctor: {
          id: rx.doctor.id,
          name: doctorName,
          email: rx.doctor.user.email,
          specialization: rx.doctor.specialization,
          licenseNumber: rx.doctor.licenseNumber,
          phone: rx.doctor.phone,
        },
        doctorName,
        patient: {
          id: rx.patient.id,
          name: rx.patient.name,
          age: rx.patient.age,
          gender: rx.patient.gender,
          contactInfo: rx.patient.contactInfo,
        },
        patientName: rx.patient.name,
      };
    }),
  };
}

// -----------------------------------------------------------------------------
// 5. ADMIN PRESCRIPTION DETAIL PROJECTION
// -----------------------------------------------------------------------------

export async function getAdminPrescriptionDetail(prescriptionId: string) {
  const prescription = await prisma.prescription.findUnique({
    where: { id: prescriptionId },
    select: {
      id: true,
      status: true,
      diagnosis: true,
      documentRef: true,
      createdAt: true,
      updatedAt: true,
      filledAt: true,
      doctor: {
        select: {
          id: true,
          specialization: true,
          licenseNumber: true,
          phone: true,
          user: {
            select: {
              email: true,
            },
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
        select: {
          id: true,
          dosage: true,
          frequency: true,
          duration: true,
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
              pharmacyType: true,
              licenseNumber: true,
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

  return {
    prescription: {
      id: prescription.id,
      status: prescription.status,
      diagnosis: prescription.diagnosis,
      documentRef: prescription.documentRef,
      createdAt: prescription.createdAt,
      updatedAt: prescription.updatedAt,
      filledAt: prescription.filledAt || prescription.fill?.filledAt || null,
      doctor: {
        id: prescription.doctor.id,
        name: doctorName,
        email: prescription.doctor.user.email,
        specialization: prescription.doctor.specialization,
        licenseNumber: prescription.doctor.licenseNumber,
        phone: prescription.doctor.phone,
      },
      doctorName,
      patient: {
        id: prescription.patient.id,
        name: prescription.patient.name,
        age: prescription.patient.age,
        gender: prescription.patient.gender,
        contactInfo: prescription.patient.contactInfo,
      },
      patientName: prescription.patient.name,
      prescriptionMedicines: prescription.prescriptionMedicines.map((pm) => ({
        id: pm.id,
        dosage: pm.dosage,
        frequency: pm.frequency,
        duration: pm.duration,
        medicine: pm.medicine,
      })),
      medicines: prescription.prescriptionMedicines.map((pm) => ({
        id: pm.id,
        dosage: pm.dosage,
        frequency: pm.frequency,
        duration: pm.duration,
        medicine: pm.medicine,
      })),
      fill: prescription.fill
        ? {
            id: prescription.fill.id,
            filledAt: prescription.fill.filledAt,
            notes: prescription.fill.notes,
            pharmacy: prescription.fill.pharmacy,
          }
        : null,
    },
  };
}

// -----------------------------------------------------------------------------
// 6. ADMIN ANALYTICS
// -----------------------------------------------------------------------------

export async function getAdminAnalyticsData() {
  const [
    totalPrescriptionsCreated,
    statusGroups,
    doctorsWithCounts,
    doctorStatusGroups,
    pharmacyProfile,
    pharmacyFillCount,
    prescribedMedicineGroups,
    filledMedicineGroups,
    pendingMedicineGroups,
    cannotFillMedicineGroups,
    timelineItems,
  ] = await Promise.all([
    prisma.prescription.count(),
    prisma.prescription.groupBy({
      by: ["status"],
      _count: { id: true },
    }),
    prisma.doctorProfile.findMany({
      select: {
        id: true,
        specialization: true,
        licenseNumber: true,
        phone: true,
        user: { select: { email: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.prescription.groupBy({
      by: ["doctorId", "status"],
      _count: { id: true },
    }),
    prisma.pharmacyProfile.findFirst({
      select: {
        id: true,
        pharmacyName: true,
        pharmacyType: true,
        licenseNumber: true,
        phone: true,
      },
    }),
    prisma.fill.count(),
    prisma.prescriptionMedicine.groupBy({
      by: ["medicineId"],
      _count: { prescriptionId: true },
    }),
    prisma.prescriptionMedicine.groupBy({
      by: ["medicineId"],
      where: { prescription: { status: PrescriptionStatus.FILLED } },
      _count: { prescriptionId: true },
    }),
    prisma.prescriptionMedicine.groupBy({
      by: ["medicineId"],
      where: { prescription: { status: PrescriptionStatus.PENDING } },
      _count: { prescriptionId: true },
    }),
    prisma.prescriptionMedicine.groupBy({
      by: ["medicineId"],
      where: { prescription: { status: PrescriptionStatus.CANNOT_FILL } },
      _count: { prescriptionId: true },
    }),
    prisma.prescription.findMany({
      select: {
        id: true,
        status: true,
        createdAt: true,
        filledAt: true,
      },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  // Overall status counts
  let totalPrescriptionsFulfilled = 0;
  let pendingPrescriptionCount = 0;
  let cannotFillCount = 0;

  for (const group of statusGroups) {
    if (group.status === PrescriptionStatus.FILLED) {
      totalPrescriptionsFulfilled = group._count.id;
    } else if (group.status === PrescriptionStatus.PENDING) {
      pendingPrescriptionCount = group._count.id;
    } else if (group.status === PrescriptionStatus.CANNOT_FILL) {
      cannotFillCount = group._count.id;
    }
  }

  const overallFulfillmentRate = calculateFulfillmentRate(
    totalPrescriptionsFulfilled,
    totalPrescriptionsCreated
  );

  // Doctor Activity Mapping
  const doctorStatusMap = new Map<string, { filled: number; pending: number; cannotFill: number }>();
  for (const g of doctorStatusGroups) {
    const current = doctorStatusMap.get(g.doctorId) || { filled: 0, pending: 0, cannotFill: 0 };
    if (g.status === PrescriptionStatus.FILLED) {
      current.filled = g._count.id;
    } else if (g.status === PrescriptionStatus.PENDING) {
      current.pending = g._count.id;
    } else if (g.status === PrescriptionStatus.CANNOT_FILL) {
      current.cannotFill = g._count.id;
    }
    doctorStatusMap.set(g.doctorId, current);
  }

  const doctorActivity = doctorsWithCounts.map((doc) => {
    const counts = doctorStatusMap.get(doc.id) || { filled: 0, pending: 0, cannotFill: 0 };
    const totalDocRx = counts.filled + counts.pending + counts.cannotFill;
    const docRate = calculateFulfillmentRate(counts.filled, totalDocRx);

    return {
      doctorId: doc.id,
      doctorName: formatDoctorDisplayName(doc.user.email),
      email: doc.user.email,
      specialization: doc.specialization,
      licenseNumber: doc.licenseNumber,
      phone: doc.phone,
      totalPrescriptions: totalDocRx,
      filledPrescriptions: counts.filled,
      pendingPrescriptions: counts.pending,
      cannotFillPrescriptions: counts.cannotFill,
      fulfillmentRate: docRate,
    };
  });

  // Pharmacy Activity Mapping (Single Pre-Provisioned Pharmacy)
  const pharmacyActivity = {
    pharmacyId: pharmacyProfile?.id ?? null,
    pharmacyName: pharmacyProfile?.pharmacyName ?? "MedEasy Central Pharmacy",
    pharmacyType: pharmacyProfile?.pharmacyType ?? "Retail & Hospital Dispensing",
    licenseNumber: pharmacyProfile?.licenseNumber ?? "N/A",
    phone: pharmacyProfile?.phone ?? "N/A",
    totalFills: pharmacyFillCount,
    totalCannotFill: cannotFillCount,
    totalPending: pendingPrescriptionCount,
    fulfillmentRate: overallFulfillmentRate,
  };

  // Medicine-wise fulfillment trends
  const prescribedMap = new Map<string, number>();
  for (const g of prescribedMedicineGroups) prescribedMap.set(g.medicineId, g._count.prescriptionId);

  const filledMap = new Map<string, number>();
  for (const g of filledMedicineGroups) filledMap.set(g.medicineId, g._count.prescriptionId);

  const pendingMap = new Map<string, number>();
  for (const g of pendingMedicineGroups) pendingMap.set(g.medicineId, g._count.prescriptionId);

  const cannotFillMap = new Map<string, number>();
  for (const g of cannotFillMedicineGroups) cannotFillMap.set(g.medicineId, g._count.prescriptionId);

  const allMedicineIds = Array.from(prescribedMap.keys());
  const medicines =
    allMedicineIds.length > 0
      ? await prisma.medicine.findMany({
          where: { id: { in: allMedicineIds } },
          select: { id: true, name: true, genericName: true, stockStatus: true },
        })
      : [];

  const medicineCatalogMap = new Map(medicines.map((m) => [m.id, m]));

  const medicineWiseFulfillmentTrends = allMedicineIds.map((medId) => {
    const catalog = medicineCatalogMap.get(medId);
    const prescribed = prescribedMap.get(medId) ?? 0;
    const filled = filledMap.get(medId) ?? 0;
    const pending = pendingMap.get(medId) ?? 0;
    const cannotFill = cannotFillMap.get(medId) ?? 0;
    const rate = calculateFulfillmentRate(filled, prescribed);

    return {
      medicineId: medId,
      name: catalog?.name ?? "Unknown Medication",
      genericName: catalog?.genericName ?? "",
      stockStatus: catalog?.stockStatus ?? true,
      prescribedCount: prescribed,
      filledCount: filled,
      pendingCount: pending,
      cannotFillCount: cannotFill,
      fulfillmentRate: rate,
    };
  });

  // Sort medicine trends by prescribed count descending
  medicineWiseFulfillmentTrends.sort((a, b) => b.prescribedCount - a.prescribedCount || a.name.localeCompare(b.name));

  // Prescription Activity Over Time (Month buckets: YYYY-MM)
  const monthNames = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];

  const periodMap = new Map<
    string,
    { total: number; filled: number; pending: number; cannotFill: number }
  >();

  for (const rx of timelineItems) {
    const periodKey = rx.createdAt.toISOString().slice(0, 7); // e.g. "2026-08"
    const current = periodMap.get(periodKey) || {
      total: 0,
      filled: 0,
      pending: 0,
      cannotFill: 0,
    };

    current.total += 1;
    if (rx.status === PrescriptionStatus.FILLED) current.filled += 1;
    else if (rx.status === PrescriptionStatus.PENDING) current.pending += 1;
    else if (rx.status === PrescriptionStatus.CANNOT_FILL) current.cannotFill += 1;

    periodMap.set(periodKey, current);
  }

  const prescriptionActivityOverTime = Array.from(periodMap.entries()).map(([period, data]) => {
    const [yearStr, monthStr] = period.split("-");
    const monthIndex = parseInt(monthStr, 10) - 1;
    const label = `${monthNames[monthIndex] || monthStr} ${yearStr}`;
    const rate = calculateFulfillmentRate(data.filled, data.total);

    return {
      period,
      label,
      total: data.total,
      filled: data.filled,
      pending: data.pending,
      cannotFill: data.cannotFill,
      fulfillmentRate: rate,
    };
  });

  return {
    totalPrescriptionsCreated,
    totalPrescriptionsFulfilled,
    overallFulfillmentRate,
    // Additional aliases for property flexibility
    fulfillmentRate: overallFulfillmentRate,
    pendingPrescriptionCount,
    cannotFillCount,
    doctorActivity,
    pharmacyActivity,
    medicineWiseFulfillmentTrends,
    prescriptionActivityOverTime,
    summary: {
      totalPrescriptionsCreated,
      totalPrescriptionsFulfilled,
      pendingPrescriptionCount,
      cannotFillCount,
      overallFulfillmentRate,
    },
  };
}

// -----------------------------------------------------------------------------
// 7. ROUTE RESPONSE WRAPPERS (With Optional userOverride For Testability)
// -----------------------------------------------------------------------------

export async function getAdminDashboardResponse(userOverride?: AuthUser | null) {
  try {
    const auth = await authorizeRequest({
      allowedRoles: [UserRole.ADMIN],
      ...(userOverride !== undefined ? { userOverride } : {}),
    });
    if (auth.errorResponse) {
      return auth.errorResponse;
    }

    const data = await getAdminDashboardData();
    return apiSuccess(data);
  } catch (error) {
    return apiError(error, "Failed to retrieve administrative dashboard metrics.");
  }
}

export async function getAdminDoctorsResponse(userOverride?: AuthUser | null) {
  try {
    const auth = await authorizeRequest({
      allowedRoles: [UserRole.ADMIN],
      ...(userOverride !== undefined ? { userOverride } : {}),
    });
    if (auth.errorResponse) {
      return auth.errorResponse;
    }

    const data = await getAdminDoctorsList();
    return apiSuccess(data);
  } catch (error) {
    return apiError(error, "Failed to retrieve administrative doctor directory.");
  }
}

export async function getAdminPharmacyResponse(userOverride?: AuthUser | null) {
  try {
    const auth = await authorizeRequest({
      allowedRoles: [UserRole.ADMIN],
      ...(userOverride !== undefined ? { userOverride } : {}),
    });
    if (auth.errorResponse) {
      return auth.errorResponse;
    }

    const data = await getAdminPharmacyInfo();
    return apiSuccess(data);
  } catch (error) {
    return apiError(error, "Failed to retrieve administrative pharmacy information.");
  }
}

export async function getAdminPrescriptionsResponse(
  options?: { status?: PrescriptionStatus },
  userOverride?: AuthUser | null
) {
  try {
    const auth = await authorizeRequest({
      allowedRoles: [UserRole.ADMIN],
      ...(userOverride !== undefined ? { userOverride } : {}),
    });
    if (auth.errorResponse) {
      return auth.errorResponse;
    }

    const data = await getAdminPrescriptionsList(options);
    return apiSuccess(data);
  } catch (error) {
    return apiError(error, "Failed to retrieve platform prescriptions.");
  }
}

export async function getAdminPrescriptionDetailResponse(
  prescriptionId: string,
  userOverride?: AuthUser | null
) {
  try {
    const auth = await authorizeRequest({
      allowedRoles: [UserRole.ADMIN],
      ...(userOverride !== undefined ? { userOverride } : {}),
    });
    if (auth.errorResponse) {
      return auth.errorResponse;
    }

    if (!prescriptionId || typeof prescriptionId !== "string" || !prescriptionId.trim()) {
      return apiError(validationError("Prescription ID is required."));
    }

    const data = await getAdminPrescriptionDetail(prescriptionId.trim());
    if ("error" in data && data.error) {
      return apiError(errorFromResult(data));
    }

    return apiSuccess(data);
  } catch (error) {
    return apiError(error, "Failed to retrieve prescription detail projection.");
  }
}

export async function getAdminAnalyticsResponse(userOverride?: AuthUser | null) {
  try {
    const auth = await authorizeRequest({
      allowedRoles: [UserRole.ADMIN],
      ...(userOverride !== undefined ? { userOverride } : {}),
    });
    if (auth.errorResponse) {
      return auth.errorResponse;
    }

    const data = await getAdminAnalyticsData();
    return apiSuccess(data);
  } catch (error) {
    return apiError(error, "Failed to retrieve platform analytics.");
  }
}
