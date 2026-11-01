/** Typed HTTP error thrown by server code and turned into a JSON response by `route()`. */
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export const Errors = {
  unauthenticated: () => new HttpError(401, "UNAUTHENTICATED", "Please sign in to continue."),
  forbidden: (message = "You do not have permission to perform this action.") => new HttpError(403, "FORBIDDEN", message),
  notFound: (what = "Resource") => new HttpError(404, "NOT_FOUND", `${what} not found.`),
  stale: () => new HttpError(409, "STALE_RECORD", "This record changed, please refresh and try again."),
  conflict: (code: string, message: string, details?: unknown) => new HttpError(409, code, message, details),
  badRequest: (message: string, details?: unknown) => new HttpError(400, "BAD_REQUEST", message, details),
  wardRequired: () => new HttpError(409, "WARD_REQUIRED", "Please choose your ward first."),
};
