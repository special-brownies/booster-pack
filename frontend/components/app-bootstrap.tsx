"use client";

import { useEffect } from "react";
import { useAppController } from "@/lib/hooks/use-app-controller";
import { useReducedMotionPreference } from "@/lib/hooks/use-reduced-motion";
import { useAppState } from "@/lib/state/app-state";

export function AppBootstrap() {
  const { hydrate } = useAppController();
  const { dispatch } = useAppState();
  const prefersReducedMotion = useReducedMotionPreference();

  useEffect(() => {
    dispatch({ type: "SET_REDUCED_MOTION", payload: prefersReducedMotion });
  }, [dispatch, prefersReducedMotion]);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  return null;
}

