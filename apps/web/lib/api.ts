import { getApiBaseUrl } from "./env";

type ApiErrorEnvelope = { error?: { code?: string; message?: string; details?: unknown } };

const DEFAULT_TIMEOUT_MS = 10000; // 10 seconds

async function apiRequest<T>(
  method: "GET" | "POST" | "PUT" | "DELETE",
  path: string,
  body?: unknown,
  init?: RequestInit
): Promise<T> {
  const url = `${getApiBaseUrl()}${path.startsWith("/") ? path : `/${path}`}`;

  // Add timeout using AbortController
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      method,
      ...init,
      signal: controller.signal,
      credentials: "include",
      headers: {
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...(init?.headers ?? {}),
        Accept: "application/json",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      const contentType = res.headers.get("content-type") ?? "";
      if (contentType.includes("application/json")) {
        const err = (await res.json().catch(() => null)) as ApiErrorEnvelope | null;
        const msg = err?.error?.message;
        const code = err?.error?.code;
        throw new Error(code ? `${code}: ${msg ?? "Request failed"}` : msg ?? `API ${res.status}`);
      }
      const text = await res.text().catch(() => "");
      throw new Error(text || `API ${res.status}`);
    }

    return (await res.json()) as T;
  } catch (error) {
    clearTimeout(timeoutId);

    // Handle timeout errors
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("REQUEST_TIMEOUT: The request took too long to complete. Please try again.");
    }

    throw error;
  }
}

export async function apiGet<T>(path: string, init?: RequestInit): Promise<T> {
  return apiRequest<T>("GET", path, undefined, init);
}

export async function apiPost<T>(path: string, body: unknown, init?: RequestInit): Promise<T> {
  return apiRequest<T>("POST", path, body, init);
}

export async function apiPut<T>(path: string, body: unknown, init?: RequestInit): Promise<T> {
  return apiRequest<T>("PUT", path, body, init);
}

export async function apiDelete<T>(path: string, init?: RequestInit): Promise<T> {
  return apiRequest<T>("DELETE", path, undefined, init);
}
