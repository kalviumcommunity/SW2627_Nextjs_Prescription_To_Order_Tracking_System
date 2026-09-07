import { getPatientPrescriptionsResponse } from "@/lib/patient-service";

export const dynamic = "force-dynamic";

/**
 * GET /api/patient/prescriptions
 * Returns prescriptions belonging strictly to the authenticated patient, including
 * prescription ID, formatted doctor name, creation timestamp, diagnosis, document reference, and status.
 */
export async function GET() {
  return getPatientPrescriptionsResponse();
}
