import { getAdminDashboardResponse } from "@/lib/admin-service";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/dashboard
 * Protected administrative endpoint returning real-time platform overview metrics.
 * Requires authenticated ADMIN role.
 */
export async function GET() {
  return getAdminDashboardResponse();
}
