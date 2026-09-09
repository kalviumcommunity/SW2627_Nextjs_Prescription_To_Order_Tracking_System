/**
 * Central Application Error Abstraction for MedEasy
 * Provides structured, typed application errors with standard HTTP status codes and error identifiers.
 */

export enum AppErrorCode {
  UNAUTHENTICATED = "UNAUTHENTICATED",
  FORBIDDEN = "FORBIDDEN",
  VALIDATION_ERROR = "VALIDATION_ERROR",
  NOT_FOUND = "NOT_FOUND",
  CONFLICT = "CONFLICT",
  BUSINESS_RULE_ERROR = "BUSINESS_RULE_ERROR",
  INTERNAL_SERVER_ERROR = "INTERNAL_SERVER_ERROR",
}

export interface AppErrorPayload {
  code: string;
  message: string;
  details?: unknown;
}

/**
 * Base Application Error class
 */
export class AppError extends Error {
  public readonly code: AppErrorCode | string;
  public readonly statusCode: number;
  public readonly details?: unknown;

  constructor(
    code: AppErrorCode | string,
    message: string,
    statusCode = 500,
    details?: unknown
  ) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  public toJSON(): AppErrorPayload {
    return {
      code: this.code,
      message: this.message,
      ...(this.details !== undefined ? { details: this.details } : {}),
    };
  }
}

/**
 * 401 UNAUTHENTICATED
 * Thrown when an unauthenticated user attempts to access a protected route or session is expired/invalid.
 */
export class UnauthenticatedError extends AppError {
  constructor(message = "Authentication required. Please sign in.") {
    super(AppErrorCode.UNAUTHENTICATED, message, 401);
    this.name = "UnauthenticatedError";
  }
}

/**
 * 403 FORBIDDEN
 * Thrown when an authenticated user lacks the required role, permission, or ownership boundary.
 */
export class ForbiddenError extends AppError {
  constructor(message = "You do not have permission to access this resource.") {
    super(AppErrorCode.FORBIDDEN, message, 403);
    this.name = "ForbiddenError";
  }
}

/**
 * 400 VALIDATION_ERROR
 * Thrown when client request payload, format, or parameter validation fails.
 */
export class ValidationError extends AppError {
  constructor(message = "Invalid request payload.", details?: unknown) {
    super(AppErrorCode.VALIDATION_ERROR, message, 400, details);
    this.name = "ValidationError";
  }
}

/**
 * 404 NOT_FOUND
 * Thrown when a requested resource does not exist (or is isolated for security reasons).
 */
export class NotFoundError extends AppError {
  constructor(message = "Resource not found.") {
    super(AppErrorCode.NOT_FOUND, message, 404);
    this.name = "NotFoundError";
  }
}

/**
 * 409 CONFLICT
 * Thrown on duplicate resource registration, state conflict, or race conditions.
 */
export class ConflictError extends AppError {
  constructor(message = "Resource conflict occurred.") {
    super(AppErrorCode.CONFLICT, message, 409);
    this.name = "ConflictError";
  }
}

/**
 * 422 / Custom BUSINESS_RULE_ERROR
 * Thrown when an action violates domain-specific workflows or business constraints.
 */
export class BusinessRuleError extends AppError {
  constructor(message: string, statusCode = 422, details?: unknown) {
    super(AppErrorCode.BUSINESS_RULE_ERROR, message, statusCode, details);
    this.name = "BusinessRuleError";
  }
}

/**
 * 500 INTERNAL_SERVER_ERROR
 * Thrown for unexpected server-side execution failures.
 */
export class InternalServerError extends AppError {
  constructor(message = "An unexpected server error occurred.") {
    super(AppErrorCode.INTERNAL_SERVER_ERROR, message, 500);
    this.name = "InternalServerError";
  }
}

/**
 * Type guard to check if an unknown error is an instance of AppError
 */
export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}
