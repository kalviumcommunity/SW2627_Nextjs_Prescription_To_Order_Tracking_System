import { getPatientPrescriptionTrackingResponse } from "@/lib/patient-service";

export const dynamic = "force-dynamic";

/**
 * GET /api/patient/prescriptions/[id]/tracking
 * Returns dedicated fulfillment tracking details for the authenticated patient's prescription.
 * Clearly represents PENDING, FILLED, and CANNOT_FILL lifecycle states.
 */
export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  return getPatientPrescriptionTrackingResponse(params?.id);
}
