import { getPharmacyHistoryResponse } from "@/lib/pharmacy-history-route";

export const dynamic = "force-dynamic";

export async function GET() {
  return getPharmacyHistoryResponse();
}