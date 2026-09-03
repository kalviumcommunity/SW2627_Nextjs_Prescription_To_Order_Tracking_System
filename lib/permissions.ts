import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  name?: string | null;
}

/**
 * Standard Application Authorization Error
 */
export class AuthorizationError extends Error {
  public statusCode: 401 | 403;

  constructor(message: string, statusCode: 401 | 403 = 403) {
    super(message);
    this.name = "AuthorizationError";
    this.statusCode = statusCode;
  }
}

/**
 * Retrieves the current authenticated user from session.
 */
export async function getAuthenticatedUser(): Promise<AuthUser | null> {
  const user = await getCurrentUser();
  if (!user || !user.id || !user.role) {
    return null;
  }
  return user as AuthUser;
}

/**
 * Enforces that a valid authenticated session exists.
 * Throws an AuthorizationError(401) if unauthenticated.
 */
export async function requireAuth(userOverride?: AuthUser | null): Promise<AuthUser> {
  const user = userOverride !== undefined ? userOverride : await getAuthenticatedUser();

  if (!user) {
    throw new AuthorizationError("Authentication required. Please sign in.", 401);
  }

  return user;
}

/**
 * Enforces that the user is authenticated and possesses one of the allowed roles.
 * Throws AuthorizationError(401) if unauthenticated, or AuthorizationError(403) on role mismatch.
 */
export async function requireRole(
  allowedRoles: UserRole | UserRole[],
  userOverride?: AuthUser | null
): Promise<AuthUser> {
  const user = await requireAuth(userOverride);
  const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

  if (!roles.includes(user.role)) {
    throw new AuthorizationError(
      "Forbidden. You do not have permission to access this resource.",
      403
    );
  }

  return user;
}

/**
 * Convenience helper to authorize a Next.js route request.
 * Returns either an error NextResponse or the authorized user.
 */
export async function authorizeRequest(options?: {
  allowedRoles?: UserRole | UserRole[];
  userOverride?: AuthUser | null;
}): Promise<
  | { user: AuthUser; errorResponse: null }
  | { user: null; errorResponse: NextResponse }
> {
  try {
    const user = options?.allowedRoles
      ? await requireRole(options.allowedRoles, options.userOverride)
      : await requireAuth(options?.userOverride);

    return { user, errorResponse: null };
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return {
        user: null,
        errorResponse: NextResponse.json(
          { error: error.message },
          { status: error.statusCode }
        ),
      };
    }

    return {
      user: null,
      errorResponse: NextResponse.json(
        { error: "An unexpected authorization error occurred." },
        { status: 500 }
      ),
    };
  }
}

// -----------------------------------------------------------------------------
// PROFILE RESOLUTION HELPERS
// -----------------------------------------------------------------------------

export async function getDoctorProfileByUserId(userId: string) {
  return await prisma.doctorProfile.findUnique({
    where: { userId },
  });
}

export async function getPatientProfileByUserId(userId: string) {
  return await prisma.patientProfile.findUnique({
    where: { userId },
  });
}

export async function getPharmacyProfileByUserId(userId: string) {
  return await prisma.pharmacyProfile.findUnique({
    where: { userId },
  });
}

// -----------------------------------------------------------------------------
// RESOURCE OWNERSHIP & RELATIONSHIP VALIDATION
// -----------------------------------------------------------------------------

/**
 * Checks if a patient is in a specific doctor's roster (DoctorPatient join table).
 */
export async function isPatientInDoctorRoster(
  doctorId: string,
  patientId: string
): Promise<boolean> {
  const relation = await prisma.doctorPatient.findUnique({
    where: {
      doctorId_patientId: {
        doctorId,
        patientId,
      },
    },
  });

  return Boolean(relation);
}

/**
 * Verifies if a doctor (by user ID) can access or manage a specific patient (by patient profile ID).
 */
export async function canDoctorAccessPatient(
  doctorUserId: string,
  patientProfileId: string
): Promise<boolean> {
  const doctorProfile = await getDoctorProfileByUserId(doctorUserId);
  if (!doctorProfile) return false;

  return await isPatientInDoctorRoster(doctorProfile.id, patientProfileId);
}

/**
 * Checks whether the given authenticated user has permission to access a prescription.
 *
 * Rules:
 * - ADMIN: Can access any prescription for monitoring/auditing.
 * - DOCTOR: Can access if the prescription was authored by this doctor.
 * - PATIENT: Can access if the prescription belongs to this patient.
 * - PHARMACY: Can access for fulfillment operations (diagnosis field must be redacted).
 */
export async function canUserAccessPrescription(
  user: AuthUser,
  prescriptionId: string
): Promise<{
  allowed: boolean;
  reason?: string;
  prescription?: Record<string, unknown>;
}> {
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
    return { allowed: false, reason: "Prescription not found." };
  }

  // 1. ADMIN access
  if (user.role === UserRole.ADMIN) {
    return { allowed: true, prescription: prescription as unknown as Record<string, unknown> };
  }

  // 2. DOCTOR access (ownership check: must be authoring doctor)
  if (user.role === UserRole.DOCTOR) {
    const doctorProfile = await getDoctorProfileByUserId(user.id);
    if (!doctorProfile || prescription.doctorId !== doctorProfile.id) {
      return {
        allowed: false,
        reason: "Access denied. You can only access prescriptions authored by you.",
      };
    }
    return { allowed: true, prescription: prescription as unknown as Record<string, unknown> };
  }

  // 3. PATIENT access (ownership check: must be prescription recipient)
  if (user.role === UserRole.PATIENT) {
    const patientProfile = await getPatientProfileByUserId(user.id);
    if (!patientProfile || prescription.patientId !== patientProfile.id) {
      return {
        allowed: false,
        reason: "Access denied. You can only access your own prescriptions.",
      };
    }
    return { allowed: true, prescription: prescription as unknown as Record<string, unknown> };
  }

  // 4. PHARMACY access (allowed for fulfillment, but diagnosis must be sanitized)
  if (user.role === UserRole.PHARMACY) {
    const pharmacyProfile = await getPharmacyProfileByUserId(user.id);
    if (!pharmacyProfile) {
      return {
        allowed: false,
        reason: "Access denied. No active pharmacy profile found.",
      };
    }

    return {
      allowed: true,
      prescription: sanitizePrescriptionForPharmacy(prescription) as unknown as Record<string, unknown>,
    };
  }

  return { allowed: false, reason: "Forbidden. Insufficient role permissions." };
}

/**
 * Redacts sensitive clinician diagnosis information from prescription data for Pharmacy access.
 */
export function sanitizePrescriptionForPharmacy<
  T extends { diagnosis?: string; [key: string]: unknown }
>(prescription: T): Omit<T, "diagnosis"> {
  const sanitized = { ...prescription };
  delete sanitized.diagnosis;
  return sanitized;
}
