import { getAdminDoctorsResponse } from "@/lib/admin-service";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/doctors
 * Protected administrative endpoint returning doctor directory information without credentials or secrets.
 * Requires authenticated ADMIN role.
 */
export async function GET() {
  return getAdminDoctorsResponse();
}
