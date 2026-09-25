const API_URL = import.meta.env.VITE_API_URL as string;

export class ApiError extends Error {
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

/** Thrown when the request never reached the server at all (offline, DNS failure, etc). */
export class NetworkError extends Error {
  constructor() {
    super("You appear to be offline");
  }
}

export type HttpMethod = "GET" | "POST" | "PATCH" | "DELETE";

export async function apiRequest<T>(method: HttpMethod, path: string, body?: unknown): Promise<T> {
  const isFormData = body instanceof FormData;
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method,
      credentials: "include",
      headers: body && !isFormData ? { "Content-Type": "application/json" } : undefined,
      body: isFormData ? body : body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new NetworkError();
  }

  if (response.status === 204) return undefined as T;

  const text = await response.text();
  const data: unknown = text ? JSON.parse(text) : undefined;

  if (!response.ok) {
    const envelope = data as { error?: { code: string; message: string; details?: unknown } } | undefined;
    const err = envelope?.error ?? { code: "unknown_error", message: "Something went wrong. Please try again." };
    throw new ApiError(response.status, err.code, err.message, err.details);
  }
  return data as T;
}

export const api = {
  get: <T>(path: string) => apiRequest<T>("GET", path),
  post: <T>(path: string, body?: unknown) => apiRequest<T>("POST", path, body),
  patch: <T>(path: string, body?: unknown) => apiRequest<T>("PATCH", path, body),
  delete: <T>(path: string) => apiRequest<T>("DELETE", path),
};
