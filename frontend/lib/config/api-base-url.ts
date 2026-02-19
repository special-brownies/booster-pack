const LOCAL_API_FALLBACK = "http://localhost:8000";

function normalizeBaseUrl(value: string | undefined): string {
  return (value ?? "").trim().replace(/\/+$/, "");
}

function resolveApiBaseUrl(): string {
  const resolved =
    normalizeBaseUrl(process.env.NEXT_PUBLIC_API_BASE_URL) ||
    normalizeBaseUrl(process.env.BACKEND_API_BASE_URL) ||
    LOCAL_API_FALLBACK;

  if (process.env.NODE_ENV === "production" && resolved.includes("localhost")) {
    console.warn("[api-base-url] Production resolved to localhost. Check NEXT_PUBLIC_API_BASE_URL.");
  }

  return resolved;
}

export const API_BASE_URL = resolveApiBaseUrl();

export function buildApiUrl(path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE_URL}${normalizedPath}`;
}
