"use client";

import { useMemo } from "react";
import { useAppState } from "@/lib/state/app-state";
import { formatSetList, getSetDisplayName } from "@/lib/utils/set-labels";

export function DashboardSummary() {
  const { state } = useAppState();

  const unlockedCount = state.unlockedSets.length;
  const totals = state.globalProgress;
  const selectedProgress = state.setProgressMap[state.selectedSet];

  const label = useMemo(() => {
    if (!selectedProgress) return "No set selected";
    return `${selectedProgress.owned_unique}/${selectedProgress.total_available} unique in ${getSetDisplayName(selectedProgress.set_id)}`;
  }, [selectedProgress]);

  return (
    <section className="summary-grid" aria-label="Collection overview">
      <article className="summary-card">
        <h2>Total Collection</h2>
        <p className="summary-card__value">
          {totals?.owned_unique ?? 0}/{totals?.total_available ?? 0}
        </p>
        <p className="summary-card__hint">
          Completion {totals?.completion_percentage?.toFixed(2) ?? "0.00"}%
        </p>
      </article>

      <article className="summary-card">
        <h2>Unlocked Sets</h2>
        <p className="summary-card__value">{unlockedCount}</p>
        <p className="summary-card__hint">{formatSetList(state.unlockedSets)}</p>
      </article>

      <article className="summary-card">
        <h2>Selected Set</h2>
        <p className="summary-card__value">{getSetDisplayName(state.selectedSet)}</p>
        <p className="summary-card__hint">{label}</p>
      </article>
    </section>
  );
}
