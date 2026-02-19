"use client";

import clsx from "clsx";
import { useEffect, useState } from "react";
import { buildCardImageUrl } from "@/lib/utils/cards";
import { getRarityGlowClass } from "@/lib/utils/rarity";

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
  const src = buildCardImageUrl(setId, cardId);
  const [status, setStatus] = useState<"loading" | "loaded" | "error">("loading");

  useEffect(() => {
    setStatus("loading");
  }, [setId, cardId, src]);

  if (status === "error") {
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
    <div className={clsx("card-image-shell", className, getRarityGlowClass(rarity))}>
      {status !== "loaded" && <div className="card-image-skeleton" aria-hidden="true" />}
      <img
        className={clsx("card-image", status !== "loaded" && "card-image--loading")}
        src={src}
        alt={cardName || cardId}
        loading="lazy"
        onLoad={() => setStatus("loaded")}
        onError={() => setStatus("error")}
      />
    </div>
  );
}
