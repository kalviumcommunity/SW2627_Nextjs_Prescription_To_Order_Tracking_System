import { getPatientPrescriptionsResponse } from "@/lib/patient-service";

export const dynamic = "force-dynamic";

export async function GET() {
  return getPatientPrescriptionsResponse();
}
