export type ApiErrorCode =
  | "VALIDATION_ERROR"
  | "INVALID_CURSOR"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "INTERNAL_ERROR"
  | "SERVICE_UNAVAILABLE";

export type Role = "USER" | "MODERATOR" | "ADMIN";

export interface ApiErrorEnvelope {
  error: {
    code: ApiErrorCode;
    message: string;
    details?: unknown;
    retryAfter?: number;
  };
}

export interface CursorResponse<T> {
  data: T[];
  cursor: string | null;
  hasMore: boolean;
}

