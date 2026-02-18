"use client";

import { useEffect, useMemo, useState } from "react";
import { BinderFilters } from "@/components/binder-filters";
import { BinderGrid, BinderCardRow } from "@/components/binder-grid";
import { CardDetailsModal } from "@/components/card-details-modal";
import { apiClient } from "@/lib/api/client";
import { BinderState, PackSlot } from "@/lib/api/types";
import { DEFAULT_SET_ORDER, useAppState } from "@/lib/state/app-state";
import { useAppController } from "@/lib/hooks/use-app-controller";
import { getSetDisplayName, sortSetIds } from "@/lib/utils/set-labels";

type RarityFilter = "all" | "common" | "uncommon" | "rare" | "holo";
type OwnershipFilter = "all" | "owned" | "missing";

function toCardNameKey(setId: string, cardId: string): string {
  return `${setId}::${cardId}`;
}

export default function BinderPage() {
  const { state } = useAppState();
  const { hydrateSetCatalog } = useAppController();
  const [binderState, setBinderState] = useState<BinderState | null>(null);
  const [selectedSet, setSelectedSet] = useState(state.selectedSet);
  const [query, setQuery] = useState("");
  const [rarity, setRarity] = useState<RarityFilter>("all");
  const [ownership, setOwnership] = useState<OwnershipFilter>("all");
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [zoomedCardKey, setZoomedCardKey] = useState<string | null>(null);
  const [cardNameMap, setCardNameMap] = useState<Record<string, string>>({});

  const setOptions = useMemo(() => {
    const fromProgress = Object.keys(state.setProgressMap);
    return fromProgress.length ? sortSetIds(fromProgress) : DEFAULT_SET_ORDER;
  }, [state.setProgressMap]);

  useEffect(() => {
    if (!setOptions.includes(selectedSet)) {
      setSelectedSet(setOptions[0]);
    }
  }, [selectedSet, setOptions]);

  useEffect(() => {
    setZoomedCardKey(null);
  }, [selectedSet]);

  useEffect(() => {
    let active = true;
    const run = async () => {
      setIsLoading(true);
      setLoadError(null);
      try {
        const [nextBinder] = await Promise.all([apiClient.getBinderState(), hydrateSetCatalog(selectedSet)]);
        if (!active) return;
        setBinderState(nextBinder);
      } catch {
        if (!active) return;
        setLoadError("Binder data is unavailable. Please retry.");
      } finally {
        if (active) setIsLoading(false);
      }
    };
    void run();
    return () => {
      active = false;
    };
  }, [hydrateSetCatalog, selectedSet]);

  useEffect(() => {
    const catalog = state.binderCache[selectedSet]?.cards ?? [];
    const missing = catalog.filter((card) => !cardNameMap[toCardNameKey(selectedSet, card.card_id)]);
    if (!missing.length) return;

    let active = true;
    const run = async () => {
      const entries = await Promise.all(
        missing.map(async (card) => {
          try {
            const metadata = await apiClient.getCardMetadata(selectedSet, card.card_id);
            const name = metadata.name?.trim() || card.card_id;
            return [toCardNameKey(selectedSet, card.card_id), name] as const;
          } catch {
            return [toCardNameKey(selectedSet, card.card_id), card.card_id] as const;
          }
        })
      );
      if (!active) return;
      setCardNameMap((prev) => {
        const next = { ...prev };
        for (const [key, name] of entries) {
          if (!next[key]) next[key] = name;
        }
        return next;
      });
    };
    void run();

    return () => {
      active = false;
    };
  }, [cardNameMap, selectedSet, state.binderCache]);

  const rows = useMemo<BinderCardRow[]>(() => {
    const catalog = state.binderCache[selectedSet]?.cards ?? [];
    const byCardId = new Map<string, number>();
    if (binderState) {
      for (const record of Object.values(binderState.cards)) {
        if (record.set_id === selectedSet) byCardId.set(record.card_id, record.quantity_owned);
      }
    }

    return catalog.map((card) => {
      const quantity = byCardId.get(card.card_id) ?? 0;
      return {
        set_id: selectedSet,
        card_id: card.card_id,
        card_name: cardNameMap[toCardNameKey(selectedSet, card.card_id)],
        rarity: card.rarity,
        quantity_owned: quantity,
        owned: quantity > 0
      };
    });
  }, [binderState, cardNameMap, selectedSet, state.binderCache]);

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      const q = query.trim().toLowerCase();
      if (q) {
        const inId = row.card_id.toLowerCase().includes(q);
        const inName = (row.card_name ?? "").toLowerCase().includes(q);
        if (!inId && !inName) return false;
      }
      if (rarity !== "all" && row.rarity !== rarity) return false;
      if (ownership === "owned" && !row.owned) return false;
      if (ownership === "missing" && row.owned) return false;
      return true;
    });
  }, [ownership, query, rarity, rows]);

  const recentCards = useMemo(() => {
    if (!binderState) return [];
    return Object.values(binderState.cards)
      .filter((x) => x.quantity_owned > 0)
      .sort((a, b) => (a.last_obtained_at > b.last_obtained_at ? -1 : 1))
      .slice(0, 8);
  }, [binderState]);

  const zoomedRow = useMemo(() => {
    if (!zoomedCardKey) return null;
    return rows.find((row) => row.card_id === zoomedCardKey) ?? null;
  }, [rows, zoomedCardKey]);

  const zoomedSlot = useMemo<PackSlot | null>(() => {
    if (!zoomedRow) return null;
    return {
      slot_index: 1,
      slot_type: zoomedRow.rarity === "common" ? "common" : zoomedRow.rarity === "uncommon" ? "uncommon" : "rare",
      rarity: zoomedRow.rarity,
      card_id: zoomedRow.card_id,
      card_name: zoomedRow.card_name,
      is_new: false,
      is_duplicate: false
    };
  }, [zoomedRow]);

  return (
    <main className="page page-binder">
      <section className="binder-summary">
        <h2>Binder Dashboard</h2>
        <p>
          Global completion: {state.globalProgress?.completion_percentage?.toFixed(2) ?? "0.00"}% (
          {state.globalProgress?.owned_unique ?? 0}/{state.globalProgress?.total_available ?? 0})
        </p>
      </section>

      <section className="set-progress-strip" aria-label="Set progress">
        {setOptions.map((setId) => {
          const progress = state.setProgressMap[setId];
          return (
            <article key={setId} className="set-progress-strip__card">
              <div className="set-progress-strip__title">
                <strong>{getSetDisplayName(setId)}</strong>
                <span>{progress?.completion_percentage?.toFixed(2) ?? "0.00"}%</span>
              </div>
              <div className="progress-track">
                <div
                  className="progress-fill"
                  style={{ width: `${Math.min(100, progress?.completion_percentage ?? 0)}%` }}
                />
              </div>
              <p>
                {progress?.owned_unique ?? 0}/{progress?.total_available ?? 0}
              </p>
            </article>
          );
        })}
      </section>

      <BinderFilters
        setId={selectedSet}
        query={query}
        rarity={rarity}
        ownership={ownership}
        setOptions={setOptions}
        onSetIdChange={setSelectedSet}
        onQueryChange={setQuery}
        onRarityChange={setRarity}
        onOwnershipChange={setOwnership}
      />

      {isLoading && <p className="empty-state">Loading binder records...</p>}
      {loadError && <p className="error-banner">{loadError}</p>}
      {!isLoading && !loadError && (
        <BinderGrid rows={filteredRows} onCardClick={(row) => setZoomedCardKey(row.card_id)} />
      )}

      <CardDetailsModal
        setId={selectedSet}
        slot={zoomedSlot}
        onClose={() => setZoomedCardKey(null)}
      />

      <section className="recent-cards">
        <h3>Recently Obtained</h3>
        <div className="recent-cards__chips">
          {recentCards.map((record) => (
            <span className="chip chip--ok" key={`${record.set_id}-${record.card_id}-${record.last_obtained_at}`}>
              {cardNameMap[toCardNameKey(record.set_id, record.card_id)] || record.card_id} x
              {record.quantity_owned}
            </span>
          ))}
          {recentCards.length === 0 && <span className="chip chip--mute">No cards yet</span>}
        </div>
      </section>
    </main>
  );
}
