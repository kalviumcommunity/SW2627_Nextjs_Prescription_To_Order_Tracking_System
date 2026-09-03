import { getDoctorAnalyticsResponse } from "@/lib/doctor-analytics-route";

export const dynamic = "force-dynamic";

/**
 * GET /api/doctor/analytics
 * Protected endpoint returning dynamic, derived clinical performance analytics
 * for the authenticated clinician.
 * 
 * Authorization:
 * - Requires authenticated session
 * - Requires UserRole.DOCTOR
 * - Strictly isolates records to the authenticated doctor
 */
export async function GET() {
  return getDoctorAnalyticsResponse();
}
