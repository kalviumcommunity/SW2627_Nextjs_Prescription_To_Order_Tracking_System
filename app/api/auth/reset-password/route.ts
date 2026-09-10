import { resetPasswordWithToken } from "@/lib/password-reset-service";
import { apiError, apiSuccess, validationError } from "@/lib/api-errors";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return apiError(validationError("Invalid request payload. Expected JSON object."));
    }

    const { email, token, password } = body as Record<string, unknown>;

    if (
      !email ||
      typeof email !== "string" ||
      !email.trim() ||
      !token ||
      typeof token !== "string" ||
      !token.trim() ||
      !password ||
      typeof password !== "string"
    ) {
      return apiError(validationError("Email, reset token, and new password are required."));
    }

    if (password.length < 8) {
      return apiError(validationError("Password must be at least 8 characters long."));
    }

    const result = await resetPasswordWithToken(email.toLowerCase().trim(), token.trim(), password);
    return apiSuccess(result);
  } catch (error: unknown) {
    if (error instanceof Error && error.message.includes("Invalid or expired")) {
      return apiError(validationError(error.message));
    }

    return apiError(error, "Failed to reset password. Please try requesting a new reset link.");
  }
}
