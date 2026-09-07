import { getPharmacyAnalyticsResponse } from "@/lib/pharmacy-analytics-route";

export const dynamic = "force-dynamic";

export async function GET() {
  return getPharmacyAnalyticsResponse();
}