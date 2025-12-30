import { HTTPException } from "hono/http-exception";

import type { Context } from "hono";

export class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export class ValidationError extends ApiError {
  constructor(
    message: string,
    public errors?: unknown,
  ) {
    super(400, message, "VALIDATION_ERROR");
    this.name = "ValidationError";
  }
}

export class UnauthorizedError extends ApiError {
  constructor(message = "Unauthorized") {
    super(401, message, "UNAUTHORIZED");
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends ApiError {
  constructor(message = "Forbidden") {
    super(403, message, "FORBIDDEN");
    this.name = "ForbiddenError";
  }
}

export class NotFoundError extends ApiError {
  constructor(message = "Resource not found") {
    super(404, message, "NOT_FOUND");
    this.name = "NotFoundError";
  }
}

export class ConflictError extends ApiError {
  constructor(message: string) {
    super(409, message, "CONFLICT");
    this.name = "ConflictError";
  }
}

export class DatabaseError extends ApiError {
  constructor(message: string) {
    super(500, message, "DATABASE_ERROR");
    this.name = "DatabaseError";
  }
}

/**
 * Global error handler middleware for Hono
 * Catches and formats all errors consistently
 */
export function errorHandler(err: Error, c: Context) {
  console.error("API Error:", err);

  // Handle Hono HTTP exceptions
  if (err instanceof HTTPException) {
    return c.json(
      {
        error: {
          message: err.message,
          code: "HTTP_EXCEPTION",
          statusCode: err.status,
        },
      },
      err.status,
    );
  }

  // Handle custom API errors
  if (err instanceof ApiError) {
    return c.json(
      {
        error: {
          message: err.message,
          code: err.code,
          statusCode: err.statusCode,
          ...(err instanceof ValidationError && err.errors
            ? { errors: err.errors }
            : {}),
        },
      },
      err.statusCode as any,
    );
  }

  // Handle unknown errors
  return c.json(
    {
      error: {
        message: "Internal server error",
        code: "INTERNAL_SERVER_ERROR",
        statusCode: 500,
      },
    },
    500 as any,
  );
}
