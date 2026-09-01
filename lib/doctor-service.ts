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
 * Helper to derive a clean display name from user email / account.
 */
export function formatDoctorDisplayName(userEmail?: string | null): string {
  if (!userEmail) return "Attending Physician";
  const emailName = userEmail.split("@")[0].replace(/^dr\./i, "").replace(/\./g, " ");
  const capitalized = emailName
    .split(" ")
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(" ");
  return `Dr. ${capitalized}`;
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

  const formattedPrescriptions = prescriptions.map((rx) => ({
    ...rx,
    doctor: rx.doctor
      ? {
          id: rx.doctor.id,
          name: formatDoctorDisplayName(rx.doctor.user?.email),
          specialization: rx.doctor.specialization,
          licenseNumber: rx.doctor.licenseNumber,
          phone: rx.doctor.phone,
        }
      : null,
  }));

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
  const doctorName = formatDoctorDisplayName(user?.email);

  return {
    doctor: {
      id: doctorProfile.id,
      name: doctorName,
      specialization: doctorProfile.specialization,
      licenseNumber: doctorProfile.licenseNumber,
      phone: doctorProfile.phone,
    },
    prescriptions: formattedPrescriptions,
  };
}

/**
 * Retrieves full details for a single prescription authored by the authenticated doctor.
 * Strictly verifies ownership; returns 404 for missing records and 403 for other doctors' records.
 * Returns all allowed fields from the approved PRD:
 * - Prescription ID
 * - Patient information (name, age, gender, contactInfo)
 * - Doctor information (name, specialization, licenseNumber, phone)
 * - Diagnosis
 * - Medicines (name, genericName, dosage, frequency, duration, stockStatus)
 * - Prescription document reference (documentRef)
 * - Status (PENDING, FILLED, CANNOT_FILL)
 * - Created timestamp (createdAt)
 * - Fulfillment timestamp when available (filledAt / fill.filledAt)
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

  // Enforce doctor ownership: reject access to another clinician's prescription
  if (prescription.doctorId !== doctorProfile.id) {
    return {
      error: "Access denied. You can only access prescriptions authored by you.",
      statusCode: 403 as const,
    };
  }

  const formattedDoctor = prescription.doctor
    ? {
        id: prescription.doctor.id,
        name: formatDoctorDisplayName(prescription.doctor.user?.email),
        specialization: prescription.doctor.specialization,
        licenseNumber: prescription.doctor.licenseNumber,
        phone: prescription.doctor.phone,
      }
    : null;

  return {
    prescription: {
      ...prescription,
      doctor: formattedDoctor,
    },
  };
}

export interface CreatePrescriptionMedicineInput {
  medicineId: string;
  dosage: string;
  frequency: string;
  duration: string;
}

export interface CreatePrescriptionInput {
  patientId: string;
  diagnosis: string;
  documentRef?: string | null;
  medicines: CreatePrescriptionMedicineInput[];
}

/**
 * Creates a new multi-medicine prescription for a patient in the authenticated doctor's roster.
 * Enforces server-side doctor identity, roster validation, catalog verification, and atomic transaction.
 * Always initializes status to PENDING.
 */
export async function createDoctorPrescription(
  userId: string,
  input: CreatePrescriptionInput
) {
  // 1. Resolve active DoctorProfile
  const doctorProfile = await getDoctorProfileByUserId(userId);
  if (!doctorProfile) {
    return { error: "Doctor profile not found.", statusCode: 404 as const };
  }

  // 2. Validate input structure
  if (!input || typeof input !== "object") {
    return { error: "Invalid request payload.", statusCode: 400 as const };
  }

  const { patientId, diagnosis, documentRef, medicines } = input;

  if (!patientId || typeof patientId !== "string" || !patientId.trim()) {
    return { error: "Patient ID is required.", statusCode: 400 as const };
  }

  if (!diagnosis || typeof diagnosis !== "string" || !diagnosis.trim()) {
    return { error: "Clinical diagnosis is required.", statusCode: 400 as const };
  }

  if (!Array.isArray(medicines) || medicines.length === 0) {
    return {
      error: "At least one medication is required in the prescription.",
      statusCode: 400 as const,
    };
  }

  // 3. Validate each medicine entry
  const medicineIds: string[] = [];
  for (let i = 0; i < medicines.length; i++) {
    const item = medicines[i];
    if (!item || typeof item !== "object") {
      return {
        error: `Medication at index ${i} is invalid.`,
        statusCode: 400 as const,
      };
    }

    if (!item.medicineId || typeof item.medicineId !== "string" || !item.medicineId.trim()) {
      return {
        error: `Medication at index ${i} is missing medicineId.`,
        statusCode: 400 as const,
      };
    }

    if (!item.dosage || typeof item.dosage !== "string" || !item.dosage.trim()) {
      return {
        error: `Medication at index ${i} is missing dosage.`,
        statusCode: 400 as const,
      };
    }

    if (!item.frequency || typeof item.frequency !== "string" || !item.frequency.trim()) {
      return {
        error: `Medication at index ${i} is missing frequency.`,
        statusCode: 400 as const,
      };
    }

    if (!item.duration || typeof item.duration !== "string" || !item.duration.trim()) {
      return {
        error: `Medication at index ${i} is missing duration.`,
        statusCode: 400 as const,
      };
    }

    medicineIds.push(item.medicineId.trim());
  }

  // 4. Validate duplicate medicines in same prescription
  const uniqueMedicineIds = new Set(medicineIds);
  if (uniqueMedicineIds.size !== medicineIds.length) {
    return {
      error: "Duplicate medication entries are not allowed in the same prescription.",
      statusCode: 400 as const,
    };
  }

  // 5. Validate patient exists
  const patientProfile = await prisma.patientProfile.findUnique({
    where: { id: patientId.trim() },
  });
  if (!patientProfile) {
    return { error: "Patient not found.", statusCode: 404 as const };
  }

  // 6. Validate doctor-patient care roster linkage
  const isLinked = await prisma.doctorPatient.findUnique({
    where: {
      doctorId_patientId: {
        doctorId: doctorProfile.id,
        patientId: patientProfile.id,
      },
    },
  });

  if (!isLinked) {
    return {
      error: "Access denied. You can only create prescriptions for patients assigned to your care roster.",
      statusCode: 403 as const,
    };
  }

  // 7. Validate all medicines exist in database catalog
  const catalogMedicines = await prisma.medicine.findMany({
    where: { id: { in: Array.from(uniqueMedicineIds) } },
  });

  if (catalogMedicines.length !== uniqueMedicineIds.size) {
    return {
      error: "One or more selected medications do not exist in the medicine catalog.",
      statusCode: 400 as const,
    };
  }

  // 8. Atomic Prisma Transaction
  try {
    const createdPrescription = await prisma.$transaction(async (tx) => {
      return await tx.prescription.create({
        data: {
          doctorId: doctorProfile.id, // Strictly determined by server session
          patientId: patientProfile.id,
          diagnosis: diagnosis.trim(),
          documentRef: documentRef && typeof documentRef === "string" ? documentRef.trim() : null,
          status: PrescriptionStatus.PENDING, // Strictly initialized to PENDING by server
          prescriptionMedicines: {
            create: medicines.map((m) => ({
              medicineId: m.medicineId.trim(),
              dosage: m.dosage.trim(),
              frequency: m.frequency.trim(),
              duration: m.duration.trim(),
            })),
          },
        },
        include: {
          doctor: {
            select: {
              id: true,
              specialization: true,
              licenseNumber: true,
              phone: true,
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
        },
      });
    });

    return {
      success: true,
      prescription: createdPrescription,
    };
  } catch (dbError) {
    console.error("Database transaction error during prescription creation:", dbError);
    return {
      error: "Failed to create prescription due to database transaction failure.",
      statusCode: 500 as const,
    };
  }
}
