import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import {
  AppError,
  AppErrorCode,
  ConflictError,
  NotFoundError,
  ValidationError,
  InternalServerError,
  isAppError,
} from "./errors";

export interface StandardErrorResponse {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

/**
 * Creates a standard error NextResponse adhering to the enterprise MedEasy API schema:
 * {
 *   "error": {
 *     "code": "FORBIDDEN",
 *     "message": "You do not have permission to access this resource."
 *   }
 * }
 */
export function errorResponse(
  error: AppError | { code: string; message: string; statusCode: number; details?: unknown }
): NextResponse<StandardErrorResponse> {
  const body: StandardErrorResponse = {
    error: {
      code: error.code,
      message: error.message,
      ...(error.details !== undefined ? { details: error.details } : {}),
    },
  };

  return NextResponse.json(body, { status: error.statusCode });
}

/**
 * Central API error handler.
 * Accepts known or unknown errors and returns a sanitized, standardized HTTP error response.
 *
 * Known application errors:
 * - Return correct HTTP status and standard JSON error shape.
 *
 * Prisma database errors:
 * - P2002 (Unique constraint): Maps to HTTP 409 CONFLICT with safe message.
 * - P2025 (Record not found): Maps to HTTP 404 NOT_FOUND.
 * - P2003 (Foreign key failure): Maps to HTTP 400 VALIDATION_ERROR.
 * - Other database errors: Logged server-side, maps to safe HTTP 500 without leaking SQL or schema internals.
 *
 * Unknown runtime errors:
 * - Logged server-side via console.error.
 * - Returns safe generic HTTP 500 response.
 * - Never exposes stack traces, SQL strings, secrets, or internal implementation details.
 */
export function apiError(error: unknown, fallbackMessage?: string): NextResponse<StandardErrorResponse> {
  // 1. Direct AppError instances
  if (isAppError(error)) {
    return errorResponse(error);
  }

  // 2. AuthorizationError compatibility (from lib/permissions.ts if not direct subclass)
  if (
    error &&
    typeof error === "object" &&
    "name" in error &&
    error.name === "AuthorizationError" &&
    "statusCode" in error &&
    typeof (error as { statusCode: unknown }).statusCode === "number"
  ) {
    const authErr = error as unknown as { statusCode: number; message?: string };
    const code =
      authErr.statusCode === 401
        ? AppErrorCode.UNAUTHENTICATED
        : AppErrorCode.FORBIDDEN;
    return errorResponse(new AppError(code, authErr.message || "Authorization failed.", authErr.statusCode));
  }

  // 3. Prisma Client Known Request Errors (P2002, P2025, P2003, etc.)
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      case "P2002": {
        // Safe conflict message without leaking schema column names or table definitions
        const target = Array.isArray(error.meta?.target)
          ? error.meta.target.join(", ")
          : typeof error.meta?.target === "string"
          ? error.meta.target
          : "";
        const message = target
          ? `A resource with this ${target} already exists.`
          : "A resource with these unique details already exists.";
        return errorResponse(new ConflictError(message));
      }
      case "P2025": {
        return errorResponse(new NotFoundError("Resource not found."));
      }
      case "P2003": {
        return errorResponse(
          new ValidationError("Referenced record does not exist or relation constraint failed.")
        );
      }
      default: {
        console.error("[Database Request Error]", error.code, error.message);
        return errorResponse(
          new InternalServerError("A database error occurred while processing the request.")
        );
      }
    }
  }

  // 4. Prisma Validation Errors (Syntactical or schema mismatches)
  if (error instanceof Prisma.PrismaClientValidationError) {
    console.error("[Database Schema Validation Error]", error.message);
    return errorResponse(new ValidationError("Database validation failed for the provided data."));
  }

  // 5. Prisma Connection / Initialization Errors
  if (error instanceof Prisma.PrismaClientInitializationError) {
    console.error("[Database Initialization Error]", error.message);
    return errorResponse(new InternalServerError("Database connection failure."));
  }

  // 6. Generic Error instances containing known business triggers (e.g., auth service thrown messages)
  if (error instanceof Error) {
    const msg = error.message;

    // Check for common conflict messages
    if (
      msg.includes("already exists") ||
      msg.includes("already registered") ||
      msg.includes("already been fulfilled") ||
      msg.includes("already been processed")
    ) {
      return errorResponse(new ConflictError(msg));
    }

    // Check for common forbidden messages
    if (msg.toLowerCase().includes("forbidden") || msg.toLowerCase().includes("access denied")) {
      return errorResponse(new AppError(AppErrorCode.FORBIDDEN, msg, 403));
    }

    // Check for common not-found messages
    if (msg.includes("not found")) {
      return errorResponse(new NotFoundError(msg));
    }

    // Check for common validation messages
    if (
      msg.includes("required") ||
      msg.includes("must be") ||
      msg.includes("Invalid or expired") ||
      msg.includes("invalid")
    ) {
      return errorResponse(new ValidationError(msg));
    }

    // Unhandled generic Error: log server-side, return safe generic 500
    console.error("[Unhandled Server Error]", error);
    return errorResponse(
      new InternalServerError(fallbackMessage || "An internal server error occurred.")
    );
  }

  // 7. Non-Error unknown throwables
  console.error("[Unknown Server Throw]", error);
  return errorResponse(
    new InternalServerError(fallbackMessage || "An unexpected error occurred.")
  );
}

/**
 * Creates a standard JSON success response.
 */
export function apiSuccess<T>(
  data: T,
  status = 200,
  headers?: HeadersInit
): NextResponse<T> {
  return NextResponse.json(data, { status, headers });
}

/**
 * Route Handler Wrapper that catches any unhandled error and passes it to apiError.
 */
export function withErrorHandler<Args extends unknown[]>(
  handler: (...args: Args) => Promise<NextResponse>
): (...args: Args) => Promise<NextResponse> {
  return async (...args: Args): Promise<NextResponse> => {
    try {
      return await handler(...args);
    } catch (error) {
      return apiError(error);
    }
  };
}
