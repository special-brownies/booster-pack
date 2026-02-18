import {
  CardMetadata,
  BinderState,
  BinderUpdateSummary,
  CollectionProgress,
  GlobalProgress,
  OpenPackRequest,
  PackResult,
  SetCatalog
} from "@/lib/api/types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";
const DEFAULT_RETRIES = 2;
const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);

export class ApiError extends Error {
  public readonly status: number;
  public readonly payload: unknown;

  constructor(message: string, status = 500, payload: unknown = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.payload = payload;
  }
}

function withBase(path: string): string {
  if (!API_BASE_URL) {
    return path;
  }
  return `${API_BASE_URL}${path}`;
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function parseJsonSafe(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function fetchWithRetry<T>(
  path: string,
  init?: RequestInit,
  retries = DEFAULT_RETRIES
): Promise<T> {
  let attempt = 0;
  let lastError: Error | null = null;

  while (attempt <= retries) {
    try {
      const response = await fetch(withBase(path), {
        ...init,
        headers: {
          "Content-Type": "application/json",
          ...(init?.headers ?? {})
        },
        cache: "no-store"
      });

      if (!response.ok) {
  const payload = await parseJsonSafe(response);

  const msg =
    payload &&
    typeof payload === "object" &&
    "error" in payload &&
    typeof (payload as any).error === "string"
      ? (payload as any).error
      : `Request failed (${response.status})`;

  const error = new ApiError(String(msg), response.status, payload);

  if (RETRYABLE_STATUS.has(response.status) && attempt < retries) {
    await sleep(250 * Math.pow(2, attempt));
    attempt += 1;
    continue;
  }

  throw error;
}


      const data = (await response.json()) as T;
      return data;
    } catch (error) {
      const isApiError = error instanceof ApiError;
      if (!isApiError && attempt < retries) {
        await sleep(250 * Math.pow(2, attempt));
        attempt += 1;
        lastError = error as Error;
        continue;
      }
      throw error;
    }
  }

  throw lastError ?? new ApiError("Request failed after retries");
}

export const apiClient = {
  openPack: async (request: OpenPackRequest): Promise<PackResult> =>
    fetchWithRetry<PackResult>("/api/open-pack", {
      method: "POST",
      body: JSON.stringify(request)
    }),

  addCardsToBinder: async (packResult: PackResult): Promise<BinderUpdateSummary> =>
    fetchWithRetry<BinderUpdateSummary>("/api/add-cards-to-binder", {
      method: "POST",
      body: JSON.stringify({ packResult })
    }),

  getCollectionProgress: async (setId: string): Promise<CollectionProgress> =>
    fetchWithRetry<CollectionProgress>(
      `/api/collection-progress?setId=${encodeURIComponent(setId)}`
    ),

  getGlobalProgress: async (): Promise<GlobalProgress> =>
    fetchWithRetry<GlobalProgress>("/api/global-progress"),

  getUnlockedSets: async (): Promise<string[]> => fetchWithRetry<string[]>("/api/unlocked-sets"),

  getBinderState: async (): Promise<BinderState> => fetchWithRetry<BinderState>("/api/binder-state"),

  getSetCatalog: async (setId: string): Promise<SetCatalog> =>
    fetchWithRetry<SetCatalog>(`/api/set-catalog?setId=${encodeURIComponent(setId)}`),

  getCardMetadata: async (setId: string, cardId: string): Promise<CardMetadata> =>
    fetchWithRetry<CardMetadata>(
      `/api/card-metadata?setId=${encodeURIComponent(setId)}&cardId=${encodeURIComponent(cardId)}`
    )
};
