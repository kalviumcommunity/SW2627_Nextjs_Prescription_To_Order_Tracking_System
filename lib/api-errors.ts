import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

export type ApplicationErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "CONFLICT"
  | "BUSINESS_RULE_ERROR"
  | "INTERNAL_SERVER_ERROR";

const statusByCode: Record<ApplicationErrorCode, number> = {
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  VALIDATION_ERROR: 400,
  NOT_FOUND: 404,
  CONFLICT: 409,
  BUSINESS_RULE_ERROR: 422,
  INTERNAL_SERVER_ERROR: 500,
};

export class ApplicationError extends Error {
  readonly code: ApplicationErrorCode;
  readonly statusCode: number;
  readonly expose: boolean;

  constructor(
    code: ApplicationErrorCode,
    message: string,
    statusCode = statusByCode[code],
    expose = true
  ) {
    super(message);
    this.name = "ApplicationError";
    this.code = code;
    this.statusCode = statusCode;
    this.expose = expose;
  }
}

export class AuthorizationError extends ApplicationError {
  constructor(message: string, statusCode: 401 | 403 = 403) {
    super(statusCode === 401 ? "UNAUTHENTICATED" : "FORBIDDEN", message, statusCode);
    this.name = "AuthorizationError";
  }
}

export function apiSuccess<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

export function apiError(error: unknown, fallbackMessage = "An unexpected error occurred.") {
  if (error instanceof ApplicationError && error.expose) {
    return NextResponse.json(
      { error: { code: error.code, message: error.message } },
      { status: error.statusCode }
    );
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      return NextResponse.json(
        { error: { code: "CONFLICT", message: "The requested resource already exists." } },
        { status: 409 }
      );
    }

    if (error.code === "P2025") {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "The requested resource was not found." } },
        { status: 404 }
      );
    }
  }

  console.error("Unhandled API error:", error);
  return NextResponse.json(
    { error: { code: "INTERNAL_SERVER_ERROR", message: fallbackMessage } },
    { status: 500 }
  );
}

export function errorFromResult(result: { error?: string; statusCode?: number }) {
  const statusCode = result.statusCode ?? 500;
  const message = result.error ?? "An unexpected error occurred.";
  const code =
    statusCode === 400
      ? "VALIDATION_ERROR"
      : statusCode === 403
        ? "FORBIDDEN"
        : statusCode === 404
          ? "NOT_FOUND"
          : statusCode === 409
            ? "CONFLICT"
            : statusCode >= 400 && statusCode < 500
              ? "BUSINESS_RULE_ERROR"
              : "INTERNAL_SERVER_ERROR";

  return new ApplicationError(code, message, statusCode, statusCode < 500);
}

export function validationError(message: string) {
  return new ApplicationError("VALIDATION_ERROR", message);
}

export function forbiddenError(message: string) {
  return new ApplicationError("FORBIDDEN", message);
}

export function notFoundError(message: string) {
  return new ApplicationError("NOT_FOUND", message);
}

export function conflictError(message: string) {
  return new ApplicationError("CONFLICT", message);
}

export function businessRuleError(message: string) {
  return new ApplicationError("BUSINESS_RULE_ERROR", message);
}
