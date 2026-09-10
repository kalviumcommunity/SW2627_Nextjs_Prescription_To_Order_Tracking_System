import { requestPasswordReset } from "@/lib/password-reset-service";
import { apiError, apiSuccess, validationError } from "@/lib/api-errors";

export const dynamic = "force-dynamic";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return apiError(validationError("Invalid request payload. Expected JSON object."));
    }

    const { email } = body as Record<string, unknown>;

    if (!email || typeof email !== "string" || !email.trim()) {
      return apiError(validationError("A valid email address is required."));
    }

    const trimmedEmail = email.toLowerCase().trim();
    if (!EMAIL_REGEX.test(trimmedEmail)) {
      return apiError(validationError("Invalid email format. Please provide a valid email address."));
    }

    const result = await requestPasswordReset(trimmedEmail);
    return apiSuccess(result);
  } catch (error: unknown) {
    return apiError(error, "An error occurred while processing your password reset request.");
  }
}
