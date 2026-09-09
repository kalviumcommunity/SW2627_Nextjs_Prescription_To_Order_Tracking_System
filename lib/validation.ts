import { ValidationError } from "./errors";

/**
 * Validates that an input is a non-empty string after trimming.
 */
export function validateRequiredString(
  value: unknown,
  fieldName: string,
  options?: { min?: number; max?: number }
): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new ValidationError(`${fieldName} is required.`);
  }

  const trimmed = value.trim();

  if (options?.min !== undefined && trimmed.length < options.min) {
    throw new ValidationError(
      `${fieldName} must be at least ${options.min} characters long.`
    );
  }

  if (options?.max !== undefined && trimmed.length > options.max) {
    throw new ValidationError(
      `${fieldName} cannot exceed ${options.max} characters.`
    );
  }

  return trimmed;
}

/**
 * Validates an email address format.
 */
export function validateEmail(email: unknown): string {
  const value = validateRequiredString(email, "Email");
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(value)) {
    throw new ValidationError("A valid email address is required.");
  }
  return value.toLowerCase();
}

/**
 * Validates password criteria (min length 8 characters by default).
 */
export function validatePassword(password: unknown, minLength = 8): string {
  if (typeof password !== "string" || password.length < minLength) {
    throw new ValidationError(
      `Password must be at least ${minLength} characters long.`
    );
  }
  return password;
}

/**
 * Validates that an input is a positive integer.
 */
export function validatePositiveInt(value: unknown, fieldName: string): number {
  const num = typeof value === "number" ? value : Number(value);
  if (isNaN(num) || !Number.isInteger(num) || num <= 0) {
    throw new ValidationError(`${fieldName} must be a positive integer.`);
  }
  return num;
}

/**
 * Validates that an input matches one of the allowed enum values.
 */
export function validateEnum<T extends string>(
  value: unknown,
  allowedValues: readonly T[],
  fieldName: string
): T {
  if (typeof value !== "string" || !allowedValues.includes(value as T)) {
    throw new ValidationError(
      `Invalid ${fieldName}. Must be one of: ${allowedValues.join(", ")}.`
    );
  }
  return value as T;
}

/**
 * Validates that an input is an array and optionally checks min length.
 */
export function validateArray<T>(
  value: unknown,
  fieldName: string,
  minLength = 1
): T[] {
  if (!Array.isArray(value) || value.length < minLength) {
    throw new ValidationError(
      `${fieldName} must be an array with at least ${minLength} item${
        minLength === 1 ? "" : "s"
      }.`
    );
  }
  return value as T[];
}

/**
 * Safely parses and validates the JSON body from an incoming Request.
 * Throws a ValidationError with HTTP 400 if the body is invalid JSON or not an object.
 */
export async function validateJsonBody<T = Record<string, unknown>>(
  req: Request
): Promise<T> {
  try {
    const body = await req.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      throw new ValidationError("Invalid request payload. Expected a JSON object.");
    }
    return body as T;
  } catch (error) {
    if (error instanceof ValidationError) {
      throw error;
    }
    throw new ValidationError("Invalid JSON in request body.");
  }
}
