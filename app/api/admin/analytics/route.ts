import { getAdminAnalyticsResponse } from "@/lib/admin-service";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/analytics
 * Protected administrative endpoint returning comprehensive database-derived platform analytics.
 * Requires authenticated ADMIN role.
 */
export async function GET() {
  return getAdminAnalyticsResponse();
}
