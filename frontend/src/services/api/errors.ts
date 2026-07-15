/** Structured API error from Django REST Framework or network failures. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fieldErrors: Record<string, string[]>;
  readonly raw: unknown;

  constructor(
    message: string,
    options: {
      status?: number;
      code?: string;
      fieldErrors?: Record<string, string[]>;
      raw?: unknown;
    } = {},
  ) {
    super(message);
    this.name = "ApiError";
    this.status = options.status ?? 0;
    this.code = options.code ?? "unknown";
    this.fieldErrors = options.fieldErrors ?? {};
    this.raw = options.raw;
  }

  static isUnauthorized(err: unknown): boolean {
    return err instanceof ApiError && (err.status === 401 || err.code === "session_expired" || err.code === "session_incompatible");
  }

  static isForbidden(err: unknown): boolean {
    return err instanceof ApiError && err.status === 403;
  }

  static isNotFound(err: unknown): boolean {
    return err instanceof ApiError && err.status === 404;
  }

  static isNetwork(err: unknown): boolean {
    return err instanceof ApiError && err.code === "network_error";
  }
}

/** @deprecated Use ApiError — kept for existing service imports. */
export class ApiUnavailableError extends ApiError {
  constructor(message = "API unavailable") {
    super(message, { code: "unavailable", status: 503 });
    this.name = "ApiUnavailableError";
  }
}
