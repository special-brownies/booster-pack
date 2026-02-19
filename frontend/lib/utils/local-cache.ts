import { GlobalProgress } from "@/lib/api/types";

const SNAPSHOT_KEY = "ptcg_frontend_snapshot_v1";

export type FrontendSnapshot = {
  unlockedSets: string[];
  globalProgress: GlobalProgress | null;
  setProgressMap: Record<string, GlobalProgress["per_set"][string]>;
  updatedAt: string;
};

export function saveSnapshot(snapshot: FrontendSnapshot): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snapshot));
  } catch {
    // Ignore local storage failures.
  }
}

export function loadSnapshot(): FrontendSnapshot | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(SNAPSHOT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as FrontendSnapshot;
    if (!Array.isArray(parsed.unlockedSets)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearSnapshot(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(SNAPSHOT_KEY);
  } catch {
    // Ignore local storage failures.
  }
}
