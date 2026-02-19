"use client";

import clsx from "clsx";
import { CardImage } from "@/components/card-image";
import { getRarityGlowClass } from "@/lib/utils/rarity";

export type BinderCardRow = {
  card_id: string;
  card_name?: string;
  rarity: "common" | "uncommon" | "rare" | "holo";
  quantity_owned: number;
  owned: boolean;
  set_id: string;
};

export function BinderGrid({
  rows,
  onCardClick
}: {
  rows: BinderCardRow[];
  onCardClick: (row: BinderCardRow) => void;
}) {
  if (rows.length === 0) {
    return <p className="empty-state">No cards match the current filters.</p>;
  }

  return (
    <section className="binder-grid" aria-label="Binder cards">
      {rows.map((row) => (
        <article
          key={`${row.set_id}-${row.card_id}`}
          className={clsx(
            "binder-card",
            getRarityGlowClass(row.rarity),
            row.owned ? "binder-card--interactive" : "binder-card--missing"
          )}
        >
          {row.owned ? (
            <button
              className="binder-card__clickable"
              onClick={() => onCardClick(row)}
              aria-label={`Open details for ${row.card_name || row.card_id}`}
            >
              <div className="binder-card__media">
                <CardImage
                  setId={row.set_id}
                  cardId={row.card_id}
                  cardName={row.card_name || row.card_id}
                  rarity={row.rarity}
                  badgeLabel={row.owned ? "OWNED" : "MISSING"}
                  className="binder-card__image"
                />
              </div>
              <div className="binder-card__meta">
                <strong>{row.card_name || row.card_id}</strong>
                <span className={`chip chip-${row.rarity}`}>{row.rarity}</span>
                <span className={clsx("chip", row.owned ? "chip--ok" : "chip--mute")}>
                  {row.owned ? `x${row.quantity_owned}` : "Missing"}
                </span>
              </div>
            </button>
          ) : (
            <div className="binder-card__static" title="Not yet collected">
              <div className="binder-card__media">
                <CardImage
                  setId={row.set_id}
                  cardId={row.card_id}
                  cardName={row.card_name || row.card_id}
                  rarity={row.rarity}
                  badgeLabel={row.owned ? "OWNED" : "MISSING"}
                  className="binder-card__image"
                />
              </div>
              <div className="binder-card__meta">
                <strong>{row.card_name || row.card_id}</strong>
                <span className={`chip chip-${row.rarity}`}>{row.rarity}</span>
                <span className={clsx("chip", row.owned ? "chip--ok" : "chip--mute")}>
                  {row.owned ? `x${row.quantity_owned}` : "Missing"}
                </span>
              </div>
            </div>
          )}
        </article>
      ))}
    </section>
  );
}
