"use client";

import { useCallback } from "react";
import { apiClient, ApiError } from "@/lib/api/client";
import { useAppState } from "@/lib/state/app-state";
import { CollectionProgress, PackConfig } from "@/lib/api/types";
import { loadSnapshot, saveSnapshot } from "@/lib/utils/local-cache";
import { getSetDisplayName } from "@/lib/utils/set-labels";

function toSetProgressMap(
  unlockedSets: string[],
  globalProgress: Awaited<ReturnType<typeof apiClient.getGlobalProgress>> | null
) {
  const map: Record<string, CollectionProgress> = {};
  if (globalProgress?.per_set) {
    for (const [setId, progress] of Object.entries(globalProgress.per_set)) {
      map[setId] = progress;
    }
  }
  for (const setId of unlockedSets) {
    if (!map[setId]) {
      map[setId] = {
        set_id: setId,
        owned_unique: 0,
        total_available: 0,
        completion_percentage: 0,
        remaining: 0,
        is_complete: false
      };
    }
  }
  return map;
}

export function useAppController() {
  const { state, dispatch } = useAppState();

  const hydrate = useCallback(async () => {
    dispatch({ type: "HYDRATE_START" });
    try {
      const [unlockedSets, globalProgress] = await Promise.all([
        apiClient.getUnlockedSets(),
        apiClient.getGlobalProgress()
      ]);
      const map = toSetProgressMap(unlockedSets, globalProgress);
      dispatch({
        type: "HYDRATE_SUCCESS",
        payload: { unlockedSets, globalProgress, setProgressMap: map }
      });
      saveSnapshot({
        unlockedSets,
        globalProgress,
        setProgressMap: map,
        updatedAt: new Date().toISOString()
      });
    } catch {
      const cached = loadSnapshot();
      if (cached) {
        dispatch({
          type: "HYDRATE_SUCCESS",
          payload: {
            unlockedSets: cached.unlockedSets,
            globalProgress: cached.globalProgress,
            setProgressMap: cached.setProgressMap
          }
        });
      } else {
        dispatch({
          type: "HYDRATE_ERROR",
          payload: "Failed to load profile data. Please check backend connectivity."
        });
      }
    }
  }, [dispatch]);

  const openPackFlow = useCallback(
    async (setId: string, config?: PackConfig) => {
      dispatch({ type: "OPEN_PACK_START" });
      try {
        const result = await apiClient.openPack({ setId, config });
        if (!Array.isArray(result.slots) || result.slots.length !== 10) {
          throw new ApiError(
            `Invalid pack size from backend: expected 10, got ${result.slots?.length ?? "unknown"}`
          );
        }
        console.info("[Pack] payload validated", {
          setId: result.set_id,
          totalCards: result.summary?.total_cards,
          revealedRange: "0 -> 9"
        });
        dispatch({ type: "OPEN_PACK_SUCCESS", payload: result });
      } catch (error) {
        const message =
          error instanceof ApiError
            ? `Failed to open pack: ${error.message}`
            : "Failed to open pack. Please try again.";
        dispatch({ type: "OPEN_PACK_ERROR", payload: message });
      }
    },
    [dispatch]
  );

  const applyBinderUpdateAfterReveal = useCallback(async () => {
    if (!state.lastOpenedPack) return;

    const previousGlobal = state.globalProgress;
    const previousMap = state.setProgressMap;
    const previousUnlocked = state.unlockedSets;
    const optimisticMap = { ...previousMap };
    const setId = state.lastOpenedPack.set_id;

    if (optimisticMap[setId]) {
      const baseline = optimisticMap[setId];
      const optimisticOwned = Math.min(
        baseline.owned_unique + state.lastOpenedPack.summary.new_cards,
        baseline.total_available
      );
      optimisticMap[setId] = {
        ...baseline,
        owned_unique: optimisticOwned,
        remaining: Math.max(baseline.total_available - optimisticOwned, 0),
        completion_percentage: baseline.total_available
          ? Number(((optimisticOwned / baseline.total_available) * 100).toFixed(2))
          : 0,
        is_complete: baseline.total_available > 0 && optimisticOwned >= baseline.total_available
      };
    }

    dispatch({ type: "BINDER_UPDATE_START" });
    dispatch({
      type: "BINDER_UPDATE_OPTIMISTIC",
      payload: {
        unlockedSets: previousUnlocked,
        globalProgress: previousGlobal,
        setProgressMap: optimisticMap
      }
    });

    try {
      const summary = await apiClient.addCardsToBinder(state.lastOpenedPack);
      const [unlockedSets, globalProgress] = await Promise.all([
        apiClient.getUnlockedSets(),
        apiClient.getGlobalProgress()
      ]);
      const setProgressMap = toSetProgressMap(unlockedSets, globalProgress);

      let celebration: { kind: "new-card" | "set-complete" | "set-unlocked"; message: string } | null =
        null;

      if (summary.newly_unlocked_sets.length > 0) {
        celebration = {
          kind: "set-unlocked",
          message: `New set unlocked: ${summary.newly_unlocked_sets.map(getSetDisplayName).join(", ")}`
        };
      } else if (summary.set_completed) {
        celebration = { kind: "set-complete", message: `${getSetDisplayName(summary.set_id)} completed!` };
      } else if (summary.new_discoveries > 0) {
        celebration = {
          kind: "new-card",
          message: `${summary.new_discoveries} new discoveries added to your binder`
        };
      }

      dispatch({
        type: "BINDER_UPDATE_SUCCESS",
        payload: { unlockedSets, globalProgress, setProgressMap, celebration }
      });

      saveSnapshot({
        unlockedSets,
        globalProgress,
        setProgressMap,
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      const message =
        error instanceof ApiError
          ? `Binder update failed: ${error.message}`
          : "Binder update failed. Your view was rolled back.";
      dispatch({ type: "BINDER_UPDATE_ERROR", payload: message });
      dispatch({
        type: "BINDER_UPDATE_SUCCESS",
        payload: {
          unlockedSets: previousUnlocked,
          globalProgress: previousGlobal,
          setProgressMap: previousMap,
          celebration: null
        }
      });
    }
  }, [dispatch, state.globalProgress, state.lastOpenedPack, state.setProgressMap, state.unlockedSets]);

  const hydrateSetCatalog = useCallback(
    async (setId: string) => {
      if (state.binderCache[setId]) return state.binderCache[setId].cards;
      const response = await fetch(`/pools/${setId}.json`, { cache: "force-cache" });
      if (!response.ok) {
        throw new ApiError(`Catalog not found for set ${setId}`, response.status);
      }
      const raw = (await response.json()) as {
        pools?: { common?: string[]; uncommon?: string[]; rare?: string[]; holo?: string[] };
      };
      const cards = [
        ...(raw.pools?.common ?? []).map((card_id) => ({ card_id, rarity: "common" as const, image_url: "" })),
        ...(raw.pools?.uncommon ?? []).map((card_id) => ({
          card_id,
          rarity: "uncommon" as const,
          image_url: ""
        })),
        ...(raw.pools?.rare ?? []).map((card_id) => ({ card_id, rarity: "rare" as const, image_url: "" })),
        ...(raw.pools?.holo ?? []).map((card_id) => ({ card_id, rarity: "holo" as const, image_url: "" }))
      ];
      dispatch({ type: "CACHE_SET_CATALOG", payload: { setId, cards } });
      return cards;
    },
    [dispatch, state.binderCache]
  );

  return {
    hydrate,
    openPackFlow,
    applyBinderUpdateAfterReveal,
    hydrateSetCatalog
  };
}
