import { resetPasswordWithToken } from "@/lib/password-reset-service";
import { apiError, apiSuccess, validationError } from "@/lib/api-errors";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, token, password } = body;

    if (!email || !token || !password) {
      return apiError(validationError("Email, reset token, and new password are required."));
    }

    if (typeof password !== "string" || password.length < 8) {
      return apiError(validationError("Password must be at least 8 characters long."));
    }

    const result = await resetPasswordWithToken(email, token, password);
    return apiSuccess(result);
  } catch (error: unknown) {
    if (error instanceof Error && error.message.includes("Invalid or expired")) {
      return apiError(validationError(error.message));
    }

    return apiError(error, "Failed to reset password. Please try requesting a new reset link.");
  }
}
