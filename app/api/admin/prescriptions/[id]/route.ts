import { NextRequest } from "next/server";
import { getAdminPrescriptionDetailResponse } from "@/lib/admin-service";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/prescriptions/[id]
 * Protected administrative endpoint returning comprehensive prescription detail projection.
 * Requires authenticated ADMIN role.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  return getAdminPrescriptionDetailResponse(params.id);
}
