import type { ApiErrorCode } from "@gitdiscover/shared";

export class AppError extends Error {
  public readonly code: ApiErrorCode;
  public readonly statusCode: number;
  public readonly details: unknown;

  constructor(code: ApiErrorCode, message: string, statusCode: number, details?: unknown) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

export class ValidationError extends AppError {
  constructor(details: unknown) {
    super("VALIDATION_ERROR", "Invalid request parameters", 400, details);
  }
}

export class InvalidCursorError extends AppError {
  constructor() {
    super("INVALID_CURSOR", "Invalid pagination cursor", 400);
  }
}

export class UnauthorizedError extends AppError {
  constructor() {
    super("UNAUTHORIZED", "Missing or invalid token", 401);
  }
}

export class ForbiddenError extends AppError {
  constructor() {
    super("FORBIDDEN", "Insufficient permissions", 403);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super("NOT_FOUND", `${resource} not found`, 404);
  }
}

export class ConflictError extends AppError {
  constructor(message = "Resource already exists") {
    super("CONFLICT", message, 409);
  }
}

