import { getAdminPharmacyResponse } from "@/lib/admin-service";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/pharmacy
 * Protected administrative endpoint returning pre-provisioned central pharmacy profile and status.
 * Requires authenticated ADMIN role.
 */
export async function GET() {
  return getAdminPharmacyResponse();
}
