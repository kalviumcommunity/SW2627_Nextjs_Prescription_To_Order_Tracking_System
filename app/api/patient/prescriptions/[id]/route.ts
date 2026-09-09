import { getPatientPrescriptionDetailResponse } from "@/lib/patient-service";

export const dynamic = "force-dynamic";

/**
 * GET /api/patient/prescriptions/[id]
 * Returns patient-permitted prescription details for the specified ID.
 * CRITICAL OWNERSHIP RULE: The authenticated patient can ONLY access their own prescriptions.
 * Querying another patient's prescription returns a safe 404 (Not Found).
 */
export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  return getPatientPrescriptionDetailResponse(params?.id);
}
