import { cookies } from "next/headers";
import { getApiBaseUrl } from "./env";

export async function apiGetServer<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${getApiBaseUrl()}${path.startsWith("/") ? path : `/${path}`}`;

  const auth = cookies().get("auth")?.value;
  const cookieHeader = auth ? `auth=${auth}` : undefined;

  const nextRevalidate = (init as RequestInit & { next?: { revalidate?: number } } | undefined)?.next?.revalidate;
  const defaultCache: RequestCache = cookieHeader ? "no-store" : nextRevalidate ? "force-cache" : "no-store";

  const res = await fetch(url, {
    ...init,
    headers: {
      ...(cookieHeader ? { Cookie: cookieHeader } : {}),
      ...(init?.headers ?? {}),
      Accept: "application/json"
    },
    cache: init?.cache ?? defaultCache
  });

  if (res.status === 401) {
    throw new Error("UNAUTHORIZED");
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`API ${res.status}: ${text}`);
  }

  return (await res.json()) as T;
}
