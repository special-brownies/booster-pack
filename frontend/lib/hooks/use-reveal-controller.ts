"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";

export type RevealMode = "manual" | "auto";
export type RevealPhase = "idle" | "flipping" | "waiting" | "completed";

type RevealState = {
  index: number;
  phase: RevealPhase;
};

type Action =
  | { type: "RESET" }
  | { type: "ADVANCE"; totalCards: number }
  | { type: "FLIP_DONE"; totalCards: number }
  | { type: "COMPLETE" };

function reducer(state: RevealState, action: Action): RevealState {
  switch (action.type) {
    case "RESET":
      return { index: -1, phase: "idle" };
    case "ADVANCE": {
      if (state.phase === "flipping" || state.phase === "completed") return state;
      const next = state.index + 1;
      if (next >= action.totalCards) {
        return { ...state, phase: "completed" };
      }
      return { index: next, phase: "flipping" };
    }
    case "FLIP_DONE": {
      if (state.phase !== "flipping") return state;
      if (state.index >= action.totalCards - 1) {
        return { ...state, phase: "completed" };
      }
      return { ...state, phase: "waiting" };
    }
    case "COMPLETE":
      return { ...state, phase: "completed" };
    default:
      return state;
  }
}

type Params = {
  totalCards: number;
  mode: RevealMode;
  autoDelayMs: number;
  onAllRevealed: () => Promise<void> | void;
};

export function useRevealController({ totalCards, mode, autoDelayMs, onAllRevealed }: Params) {
  const [state, dispatch] = useReducer(reducer, { index: -1, phase: "idle" });
  const completedRef = useRef(false);

  const reset = useCallback(() => {
    completedRef.current = false;
    dispatch({ type: "RESET" });
  }, []);

  useEffect(() => {
    reset();
  }, [totalCards, reset]);

  const revealNext = useCallback(() => {
    dispatch({ type: "ADVANCE", totalCards });
  }, [totalCards]);

  const onFlipAnimationComplete = useCallback(() => {
    dispatch({ type: "FLIP_DONE", totalCards });
  }, [totalCards]);

  useEffect(() => {
    if (mode !== "auto") return;
    if (state.phase !== "idle" && state.phase !== "waiting") return;
    if (state.phase === "completed") return;
    const timer = window.setTimeout(() => {
      revealNext();
    }, autoDelayMs);
    return () => window.clearTimeout(timer);
  }, [autoDelayMs, mode, revealNext, state.phase]);

  useEffect(() => {
    if (state.phase !== "completed") return;
    if (completedRef.current) return;
    completedRef.current = true;
    console.info("[Reveal] completed", { totalCards, finalIndex: state.index });
    void onAllRevealed();
  }, [onAllRevealed, state.index, state.phase, totalCards]);

  const visibleCount = useMemo(() => Math.max(0, state.index + 1), [state.index]);
  const canAdvance = state.phase === "idle" || state.phase === "waiting";
  const isComplete = state.phase === "completed";

  return {
    currentIndex: state.index,
    phase: state.phase,
    visibleCount,
    canAdvance,
    isComplete,
    revealNext,
    onFlipAnimationComplete,
    reset
  };
}

