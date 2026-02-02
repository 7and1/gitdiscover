export function getAppUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3002";
}

export function getApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001/v1";
}

export function getApiOrigin(): string {
  const base = getApiBaseUrl();
  try {
    const u = new URL(base);
    u.pathname = "";
    u.search = "";
    u.hash = "";
    return u.toString().replace(/\/$/, "");
  } catch {
    return "http://localhost:3001";
  }
}

