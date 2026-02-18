"use client";

import clsx from "clsx";
import { useEffect, useState } from "react";
import { getCardImageUrl } from "@/lib/utils/cards";

type Props = {
  setId: string;
  cardId: string;
  cardName?: string;
  rarity: string;
  badgeLabel: string;
  className?: string;
  hideCardId?: boolean;
};

export function CardImage({
  setId,
  cardId,
  cardName,
  rarity,
  badgeLabel,
  className,
  hideCardId = false
}: Props) {
  const src = getCardImageUrl(setId, cardId);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    setMissing(false);
    // Required diagnostic log for local path resolution.
    console.info("[CardImage] resolved", { setId, cardId, src });
  }, [setId, cardId, src]);

  if (missing) {
    return (
      <div className={clsx("card-fallback", className)} role="img" aria-label={`${cardId} fallback`}>
        <p className="card-fallback__name">{cardName || cardId}</p>
        {!hideCardId && <p className="card-fallback__id">{cardId}</p>}
        <div className="card-fallback__chips">
          <span className="chip">{rarity}</span>
          <span className={clsx("chip", badgeLabel === "NEW" ? "chip--ok" : "chip--warn")}>
            {badgeLabel}
          </span>
        </div>
      </div>
    );
  }

  return (
    <img
      className={clsx("card-image", className)}
      src={src}
      alt={cardName || cardId}
      loading="lazy"
      onError={() => {
        console.warn("[CardImage] missing image fallback", { setId, cardId, src });
        setMissing(true);
      }}
    />
  );
}
