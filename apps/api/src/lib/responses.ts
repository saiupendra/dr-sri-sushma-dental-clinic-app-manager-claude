export class HttpError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const notFound = (what: string) => new HttpError(404, "not_found", `${what} not found`);
export const forbidden = (message = "You do not have permission to do that") =>
  new HttpError(403, "forbidden", message);
export const unauthorized = (message = "Sign in to continue") =>
  new HttpError(401, "unauthorized", message);
export const badRequest = (message: string, details?: unknown) =>
  new HttpError(400, "bad_request", message, details);
export const conflict = (message: string) => new HttpError(409, "conflict", message);
