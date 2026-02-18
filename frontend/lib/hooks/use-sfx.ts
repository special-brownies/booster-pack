"use client";

import { useCallback } from "react";

export function useSfx() {
  const play = useCallback((name: "pack-tear" | "card-flip" | "celebrate") => {
    if (typeof window === "undefined") return;
    const hook = (window as Window & { __PTCG_PLAY_SFX__?: (name: string) => void })
      .__PTCG_PLAY_SFX__;
    if (hook) hook(name);
  }, []);

  return {
    playPackTear: () => play("pack-tear"),
    playCardFlip: () => play("card-flip"),
    playCelebrate: () => play("celebrate")
  };
}

