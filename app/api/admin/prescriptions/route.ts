import { NextRequest } from "next/server";
import { PrescriptionStatus } from "@prisma/client";
import { getAdminPrescriptionsResponse } from "@/lib/admin-service";
import { apiError, validationError } from "@/lib/api-errors";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/prescriptions
 * Protected administrative endpoint returning platform-wide prescription list.
 * Optionally filterable by status via query parameter ?status=
 * Requires authenticated ADMIN role.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const statusParam = searchParams.get("status");
  if (statusParam && !Object.values(PrescriptionStatus).includes(statusParam as PrescriptionStatus)) {
    return apiError(validationError("Invalid prescription status filter."));
  }
  const status =
    statusParam
      ? (statusParam as PrescriptionStatus)
      : undefined;

  return getAdminPrescriptionsResponse({ status });
}
