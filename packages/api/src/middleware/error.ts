import {
  type ErrorCode,
  ErrorCodes,
  isErrorCode,
} from "@prostcounter/shared/errors";
import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";

import { logger } from "../lib/logger";

export class ApiError extends Error {
  public code: ErrorCode;

  constructor(
    public statusCode: number,
    codeOrMessage: ErrorCode | string,
    message?: string,
  ) {
    // If codeOrMessage is a valid ErrorCode, use it as code
    // Otherwise, use the default code and codeOrMessage as message
    if (isErrorCode(codeOrMessage)) {
      super(message || codeOrMessage);
      this.code = codeOrMessage;
    } else {
      super(codeOrMessage);
      this.code = ErrorCodes.INTERNAL_ERROR;
    }
    this.name = "ApiError";
  }
}

export class ValidationError extends ApiError {
  constructor(
    codeOrMessage: ErrorCode | string = ErrorCodes.VALIDATION_ERROR,
    public errors?: unknown,
  ) {
    if (isErrorCode(codeOrMessage)) {
      super(400, codeOrMessage);
    } else {
      super(400, ErrorCodes.VALIDATION_ERROR, codeOrMessage);
    }
    this.name = "ValidationError";
  }
}

export class UnauthorizedError extends ApiError {
  constructor(codeOrMessage: ErrorCode | string = ErrorCodes.UNAUTHORIZED) {
    if (isErrorCode(codeOrMessage)) {
      super(401, codeOrMessage);
    } else {
      super(401, ErrorCodes.UNAUTHORIZED, codeOrMessage);
    }
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends ApiError {
  constructor(codeOrMessage: ErrorCode | string = ErrorCodes.FORBIDDEN) {
    if (isErrorCode(codeOrMessage)) {
      super(403, codeOrMessage);
    } else {
      super(403, ErrorCodes.FORBIDDEN, codeOrMessage);
    }
    this.name = "ForbiddenError";
  }
}

export class NotFoundError extends ApiError {
  constructor(codeOrMessage: ErrorCode | string = ErrorCodes.NOT_FOUND) {
    if (isErrorCode(codeOrMessage)) {
      super(404, codeOrMessage);
    } else {
      super(404, ErrorCodes.NOT_FOUND, codeOrMessage);
    }
    this.name = "NotFoundError";
  }
}

export class ConflictError extends ApiError {
  constructor(codeOrMessage: ErrorCode | string = ErrorCodes.CONFLICT) {
    if (isErrorCode(codeOrMessage)) {
      super(409, codeOrMessage);
    } else {
      super(409, ErrorCodes.CONFLICT, codeOrMessage);
    }
    this.name = "ConflictError";
  }
}

export class DatabaseError extends ApiError {
  constructor(codeOrMessage: ErrorCode | string = ErrorCodes.DATABASE_ERROR) {
    if (isErrorCode(codeOrMessage)) {
      super(500, codeOrMessage);
    } else {
      super(500, ErrorCodes.DATABASE_ERROR, codeOrMessage);
    }
    this.name = "DatabaseError";
  }
}

/**
 * Global error handler middleware for Hono
 * Catches and formats all errors consistently
 */
export function errorHandler(err: Error, c: Context) {
  const userId = c.get("userId") as string | undefined;
  const userEmail = c.get("userEmail") as string | undefined;

  // Handle Hono HTTP exceptions
  if (err instanceof HTTPException) {
    logger.warn({
      type: "http_exception",
      error: err.message,
      status: err.status,
      method: c.req.method,
      path: c.req.path,
      userId,
      userEmail,
    });

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
    const logLevel = err.statusCode >= 500 ? "error" : "warn";

    logger[logLevel]({
      type: "api_error",
      error: err.message,
      code: err.code,
      status: err.statusCode,
      method: c.req.method,
      path: c.req.path,
      userId,
      userEmail,
      ...(err instanceof ValidationError && err.errors
        ? { validationErrors: err.errors }
        : {}),
    });

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

  // Handle unknown errors - these are real bugs
  logger.error({
    type: "unknown_error",
    error: err.message,
    stack: err.stack,
    method: c.req.method,
    path: c.req.path,
    userId,
    userEmail,
  });

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
