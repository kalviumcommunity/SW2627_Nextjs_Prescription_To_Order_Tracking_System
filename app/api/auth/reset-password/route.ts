import { resetPasswordWithToken } from "@/lib/password-reset-service";
import { apiError, apiSuccess } from "@/lib/api-response";
import { validateEmail, validatePassword, validateRequiredString, validateJsonBody } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await validateJsonBody<{ email?: unknown; token?: unknown; password?: unknown }>(req);

    if (!body.email || !body.token || !body.password) {
      throw new Error("Email, reset token, and new password are required.");
    }

    const email = validateEmail(body.email);
    const token = validateRequiredString(body.token, "Reset token");
    const password = validatePassword(body.password, 8);

    const result = await resetPasswordWithToken(email, token, password);
    return apiSuccess(result, 200);
  } catch (error) {
    return apiError(error, "Failed to reset password. Please try requesting a new reset link.");
  }
}
