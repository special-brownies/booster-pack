"use client";

import { createContext, useContext, useMemo, useReducer, type Dispatch, type ReactNode } from "react";
import { CollectionProgress, GlobalProgress, PackResult, SetCatalog } from "@/lib/api/types";

export const DEFAULT_SET_ORDER = ["base2", "jungle", "fossil", "base3", "base4", "base5"];

type UIState = {
  isHydrating: boolean;
  isOpeningPack: boolean;
  isUpdatingBinder: boolean;
  isRevealing: boolean;
  revealStep: number;
  animationState: "idle" | "tearing" | "revealing" | "complete";
  errorMessage: string | null;
  celebration:
    | {
        kind: "new-card" | "set-complete" | "set-unlocked";
        message: string;
      }
    | null;
};

type BinderCacheEntry = {
  loadedAt: string;
  cards: SetCatalog["cards"];
};

export type AppState = {
  selectedSet: string;
  unlockedSets: string[];
  globalProgress: GlobalProgress | null;
  setProgressMap: Record<string, CollectionProgress>;
  lastOpenedPack: PackResult | null;
  binderCache: Record<string, BinderCacheEntry>;
  reducedMotion: boolean;
  ui: UIState;
};

type AppAction =
  | { type: "HYDRATE_START" }
  | {
      type: "HYDRATE_SUCCESS";
      payload: {
        unlockedSets: string[];
        globalProgress: GlobalProgress | null;
        setProgressMap: Record<string, CollectionProgress>;
      };
    }
  | { type: "HYDRATE_ERROR"; payload: string }
  | { type: "SET_SELECTED_SET"; payload: string }
  | { type: "OPEN_PACK_START" }
  | { type: "OPEN_PACK_SUCCESS"; payload: PackResult }
  | { type: "OPEN_PACK_ERROR"; payload: string }
  | { type: "SET_REVEAL_STEP"; payload: number }
  | { type: "REVEAL_START" }
  | { type: "REVEAL_COMPLETE" }
  | { type: "BINDER_UPDATE_START" }
  | {
      type: "BINDER_UPDATE_OPTIMISTIC";
      payload: {
        unlockedSets: string[];
        globalProgress: GlobalProgress | null;
        setProgressMap: Record<string, CollectionProgress>;
      };
    }
  | {
      type: "BINDER_UPDATE_SUCCESS";
      payload: {
        unlockedSets: string[];
        globalProgress: GlobalProgress | null;
        setProgressMap: Record<string, CollectionProgress>;
        celebration: AppState["ui"]["celebration"];
      };
    }
  | { type: "BINDER_UPDATE_ERROR"; payload: string }
  | { type: "CACHE_SET_CATALOG"; payload: { setId: string; cards: SetCatalog["cards"] } }
  | { type: "DISMISS_CELEBRATION" }
  | { type: "SET_REDUCED_MOTION"; payload: boolean };

const initialState: AppState = {
  selectedSet: DEFAULT_SET_ORDER[0],
  unlockedSets: [DEFAULT_SET_ORDER[0]],
  globalProgress: null,
  setProgressMap: {},
  lastOpenedPack: null,
  binderCache: {},
  reducedMotion: false,
  ui: {
    isHydrating: false,
    isOpeningPack: false,
    isUpdatingBinder: false,
    isRevealing: false,
    revealStep: -1,
    animationState: "idle",
    errorMessage: null,
    celebration: null
  }
};

function reducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case "HYDRATE_START":
      return {
        ...state,
        ui: { ...state.ui, isHydrating: true, errorMessage: null }
      };
    case "HYDRATE_SUCCESS":
      return {
        ...state,
        unlockedSets: action.payload.unlockedSets.length
          ? action.payload.unlockedSets
          : [DEFAULT_SET_ORDER[0]],
        globalProgress: action.payload.globalProgress,
        setProgressMap: action.payload.setProgressMap,
        selectedSet: action.payload.unlockedSets.includes(state.selectedSet)
          ? state.selectedSet
          : action.payload.unlockedSets[0] ?? DEFAULT_SET_ORDER[0],
        ui: { ...state.ui, isHydrating: false }
      };
    case "HYDRATE_ERROR":
      return {
        ...state,
        ui: { ...state.ui, isHydrating: false, errorMessage: action.payload }
      };
    case "SET_SELECTED_SET":
      return { ...state, selectedSet: action.payload };
    case "OPEN_PACK_START":
      return {
        ...state,
        ui: {
          ...state.ui,
          errorMessage: null,
          isOpeningPack: true,
          animationState: "tearing",
          revealStep: -1
        }
      };
    case "OPEN_PACK_SUCCESS":
      return {
        ...state,
        lastOpenedPack: action.payload,
        ui: {
          ...state.ui,
          isOpeningPack: false,
          isRevealing: true,
          animationState: "revealing",
          revealStep: -1
        }
      };
    case "OPEN_PACK_ERROR":
      return {
        ...state,
        ui: {
          ...state.ui,
          isOpeningPack: false,
          isRevealing: false,
          animationState: "idle",
          errorMessage: action.payload
        }
      };
    case "SET_REVEAL_STEP":
      return { ...state, ui: { ...state.ui, revealStep: action.payload } };
    case "REVEAL_START":
      return {
        ...state,
        ui: { ...state.ui, isRevealing: true, animationState: "revealing", revealStep: -1 }
      };
    case "REVEAL_COMPLETE":
      return {
        ...state,
        ui: { ...state.ui, isRevealing: false, animationState: "complete" }
      };
    case "BINDER_UPDATE_START":
      return {
        ...state,
        ui: { ...state.ui, isUpdatingBinder: true, errorMessage: null }
      };
    case "BINDER_UPDATE_OPTIMISTIC":
      return {
        ...state,
        unlockedSets: action.payload.unlockedSets.length
          ? action.payload.unlockedSets
          : state.unlockedSets,
        globalProgress: action.payload.globalProgress,
        setProgressMap: action.payload.setProgressMap,
        ui: {
          ...state.ui,
          isUpdatingBinder: true,
          animationState: "complete"
        }
      };
    case "BINDER_UPDATE_SUCCESS":
      return {
        ...state,
        unlockedSets: action.payload.unlockedSets.length
          ? action.payload.unlockedSets
          : state.unlockedSets,
        globalProgress: action.payload.globalProgress,
        setProgressMap: action.payload.setProgressMap,
        ui: {
          ...state.ui,
          isUpdatingBinder: false,
          animationState: "idle",
          celebration: action.payload.celebration
        }
      };
    case "BINDER_UPDATE_ERROR":
      return {
        ...state,
        ui: {
          ...state.ui,
          isUpdatingBinder: false,
          errorMessage: action.payload,
          animationState: "idle"
        }
      };
    case "CACHE_SET_CATALOG":
      return {
        ...state,
        binderCache: {
          ...state.binderCache,
          [action.payload.setId]: {
            loadedAt: new Date().toISOString(),
            cards: action.payload.cards
          }
        }
      };
    case "DISMISS_CELEBRATION":
      return { ...state, ui: { ...state.ui, celebration: null } };
    case "SET_REDUCED_MOTION":
      return { ...state, reducedMotion: action.payload };
    default:
      return state;
  }
}

type AppStore = {
  state: AppState;
  dispatch: Dispatch<AppAction>;
};

const AppStateContext = createContext<AppStore | null>(null);

export function AppStateProvider({
  children,
  initial
}: {
  children: ReactNode;
  initial?: Partial<AppState>;
}) {
  const mergedInitial = useMemo<AppState>(
    () => ({
      ...initialState,
      ...initial,
      ui: { ...initialState.ui, ...(initial?.ui ?? {}) }
    }),
    [initial]
  );

  const [state, dispatch] = useReducer(reducer, mergedInitial);
  const value = useMemo(() => ({ state, dispatch }), [state]);
  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState(): AppStore {
  const ctx = useContext(AppStateContext);
  if (!ctx) {
    throw new Error("useAppState must be used inside AppStateProvider");
  }
  return ctx;
}
