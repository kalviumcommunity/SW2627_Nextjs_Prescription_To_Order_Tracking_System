import { getPatientDashboardResponse } from "@/lib/patient-service";

export const dynamic = "force-dynamic";

/**
 * GET /api/patient/dashboard
 * Protected endpoint returning live DB-derived prescription metrics and recent activity for the authenticated patient.
 */
export async function GET() {
  return getPatientDashboardResponse();
}
