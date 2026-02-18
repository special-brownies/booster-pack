"use client";

import clsx from "clsx";
import { DEFAULT_SET_ORDER, useAppState } from "@/lib/state/app-state";
import { getSetDisplayName } from "@/lib/utils/set-labels";

type Props = {
  onOpenPack: () => void;
};

export function PackSelectionBoard({ onOpenPack }: Props) {
  const { state, dispatch } = useAppState();

  return (
    <section aria-label="Pack set selection" className="set-board">
      <div className="set-board__header">
        <h2>Choose Your Set</h2>
        <button
          className="btn btn--primary"
          onClick={onOpenPack}
          disabled={
            state.ui.isOpeningPack ||
            state.ui.isUpdatingBinder ||
            !state.unlockedSets.includes(state.selectedSet)
          }
        >
          {state.ui.isOpeningPack
            ? "Opening..."
            : `Open ${getSetDisplayName(state.selectedSet)} Pack`}
        </button>
      </div>

      <div className="set-board__grid" role="list">
        {DEFAULT_SET_ORDER.map((setId) => {
          const progress = state.setProgressMap[setId];
          const unlocked = state.unlockedSets.includes(setId);
          return (
            <button
              role="listitem"
              key={setId}
              className={clsx(
                "set-card",
                unlocked ? "set-card--unlocked" : "set-card--locked",
                state.selectedSet === setId && "set-card--selected"
              )}
              onClick={() => dispatch({ type: "SET_SELECTED_SET", payload: setId })}
              disabled={!unlocked}
              aria-pressed={state.selectedSet === setId}
              aria-label={`${getSetDisplayName(setId)} ${unlocked ? "unlocked" : "locked"}`}
            >
              <div className="set-card__title-row">
                <h3>{getSetDisplayName(setId)}</h3>
                <span className={clsx("chip", unlocked ? "chip--ok" : "chip--mute")}>
                  {unlocked ? "Unlocked" : "Locked"}
                </span>
              </div>
              <p className="set-card__stats">
                {progress?.owned_unique ?? 0}/{progress?.total_available ?? 0} unique
              </p>
              <div className="progress-track" aria-hidden="true">
                <div
                  className="progress-fill"
                  style={{ width: `${Math.max(0, Math.min(progress?.completion_percentage ?? 0, 100))}%` }}
                />
              </div>
              <p className="set-card__pct">{progress?.completion_percentage?.toFixed(2) ?? "0.00"}%</p>
            </button>
          );
        })}
      </div>
    </section>
  );
}
