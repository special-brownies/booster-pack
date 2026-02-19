"use client";

import { useMemo } from "react";
import { DashboardSummary } from "@/components/dashboard-summary";
import { PackRevealStage } from "@/components/pack-reveal-stage";
import { PackSelectionBoard } from "@/components/pack-selection-board";
import { useAppController } from "@/lib/hooks/use-app-controller";
import { useAppState } from "@/lib/state/app-state";
import { useSfx } from "@/lib/hooks/use-sfx";
import clsx from "clsx";

export default function HomePage() {
  const { state } = useAppState();
  const { openPackFlow, applyBinderUpdateAfterReveal } = useAppController();
  const { playPackTear } = useSfx();

  const canOpen = useMemo(
    () => state.unlockedSets.includes(state.selectedSet) && !state.ui.isUpdatingBinder,
    [state.selectedSet, state.ui.isUpdatingBinder, state.unlockedSets]
  );

  const onOpenPack = async () => {
    if (!canOpen) return;
    playPackTear();
    await openPackFlow(state.selectedSet);
  };

  return (
    <main className={clsx("page page-home", state.ui.animationState === "tearing" && "anim-tearing")}>
      <DashboardSummary />
      <PackSelectionBoard onOpenPack={onOpenPack} />
      <PackRevealStage
        pack={state.lastOpenedPack}
        onRevealComplete={applyBinderUpdateAfterReveal}
        onOpenAnotherPack={onOpenPack}
      />
    </main>
  );
}
