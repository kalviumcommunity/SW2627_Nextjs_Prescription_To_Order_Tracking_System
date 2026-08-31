import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth-service";

/**
 * Interface representing an external Email Service Provider
 * Integration points: SendGrid, AWS SES, Resend, Postmark, Nodemailer, etc.
 */
export interface PasswordResetEmailProvider {
  /**
   * Sends a password reset email to the recipient with the reset token/link.
   * Note: In production, the raw token is sent only in the direct email link.
   */
  sendPasswordResetEmail(email: string, resetToken: string): Promise<void>;
}

/**
 * Development-safe Mock Email Provider
 * Safe fallback when no production SMTP / SES provider is configured.
 * Logs execution without exposing secret tokens in production logs.
 */
export class DevelopmentEmailProvider implements PasswordResetEmailProvider {
  async sendPasswordResetEmail(email: string, resetToken: string): Promise<void> {
    if (process.env.NODE_ENV === "development") {
      console.log(`[DevelopmentEmailProvider] Password reset email simulated for: ${email} (token length: ${resetToken.length})`);
    }
  }
}

/**
 * Active email provider instance.
 * To integrate SendGrid/SES/Resend, instantiate the provider here or via dependency injection.
 */
export const emailProvider: PasswordResetEmailProvider = new DevelopmentEmailProvider();

interface ResetTokenRecord {
  hashedToken: string;
  email: string;
  expiresAt: number;
}

// In-memory token store for development and testing (TTL-based)
// In a scaled multi-instance cluster, this can be backed by Redis or a dedicated DB table.
const resetTokenStore = new Map<string, ResetTokenRecord>();

const TOKEN_EXPIRY_MS = 15 * 60 * 1000; // 15 minutes validity

/**
 * Generates a secure random reset token and stores its SHA-256 hash.
 */
export async function createPasswordResetToken(email: string): Promise<string> {
  const normalizedEmail = email.toLowerCase().trim();
  const rawToken = crypto.randomBytes(32).toString("hex");
  const hashedToken = crypto.createHash("sha256").update(rawToken).digest("hex");
  const expiresAt = Date.now() + TOKEN_EXPIRY_MS;

  resetTokenStore.set(normalizedEmail, {
    hashedToken,
    email: normalizedEmail,
    expiresAt,
  });

  return rawToken;
}

/**
 * Initiates the password reset flow.
 * Note: Always returns a generic success message to prevent user enumeration attacks.
 */
export async function requestPasswordReset(
  email: string,
  provider: PasswordResetEmailProvider = emailProvider
): Promise<{ success: boolean; message: string; devToken?: string }> {
  const normalizedEmail = email.toLowerCase().trim();

  // Check if user exists in DB
  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  if (user) {
    const rawToken = await createPasswordResetToken(normalizedEmail);
    await provider.sendPasswordResetEmail(normalizedEmail, rawToken);

    return {
      success: true,
      message: "If an account exists with this email, password reset instructions have been sent.",
      ...(process.env.NODE_ENV === "test" ? { devToken: rawToken } : {}),
    };
  }

  // Return identical message even if user doesn't exist (anti-enumeration)
  return {
    success: true,
    message: "If an account exists with this email, password reset instructions have been sent.",
  };
}

/**
 * Validates whether a reset token is valid and unexpired for the given email.
 */
export async function validateResetToken(email: string, rawToken: string): Promise<boolean> {
  if (!email || !rawToken) return false;

  const normalizedEmail = email.toLowerCase().trim();
  const record = resetTokenStore.get(normalizedEmail);

  if (!record) return false;

  if (Date.now() > record.expiresAt) {
    resetTokenStore.delete(normalizedEmail);
    return false;
  }

  const hashedAttempt = crypto.createHash("sha256").update(rawToken.trim()).digest("hex");
  return crypto.timingSafeEqual(Buffer.from(hashedAttempt), Buffer.from(record.hashedToken));
}

/**
 * Resets user password using a verified reset token.
 */
export async function resetPasswordWithToken(
  email: string,
  rawToken: string,
  newPassword: string
): Promise<{ success: boolean; message: string }> {
  const normalizedEmail = email.toLowerCase().trim();

  if (!newPassword || newPassword.length < 8) {
    throw new Error("Password must be at least 8 characters long.");
  }

  const isValid = await validateResetToken(normalizedEmail, rawToken);
  if (!isValid) {
    throw new Error("Invalid or expired password reset token.");
  }

  const hashedPassword = await hashPassword(newPassword);

  await prisma.user.update({
    where: { email: normalizedEmail },
    data: { password: hashedPassword },
  });

  // Invalidate token after single use (replay attack prevention)
  resetTokenStore.delete(normalizedEmail);

  return {
    success: true,
    message: "Password has been successfully updated. You may now log in.",
  };
}

/**
 * Utility helper for test environments to clear token store
 */
export function clearResetTokensForTesting() {
  resetTokenStore.clear();
}
