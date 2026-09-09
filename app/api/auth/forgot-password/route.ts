import { requestPasswordReset } from "@/lib/password-reset-service";
import { apiError, apiSuccess } from "@/lib/api-response";
import { validateEmail, validateJsonBody } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await validateJsonBody<{ email?: unknown }>(req);
    const email = validateEmail(body.email);

    const result = await requestPasswordReset(email);
    return apiSuccess(result, 200);
  } catch (error) {
    return apiError(error, "An error occurred while processing your password reset request.");
  }
}
