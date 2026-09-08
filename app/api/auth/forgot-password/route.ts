import { requestPasswordReset } from "@/lib/password-reset-service";
import { apiError, apiSuccess, validationError } from "@/lib/api-errors";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email } = body;

    if (!email || typeof email !== "string") {
      return apiError(validationError("A valid email address is required."));
    }

    const result = await requestPasswordReset(email);
    return apiSuccess(result);
  } catch (error: unknown) {
    return apiError(error, "An error occurred while processing your password reset request.");
  }
}
