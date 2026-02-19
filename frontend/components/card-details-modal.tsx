"use client";

import { useEffect, useState } from "react";
import { PackSlot, ResolvedPokemonDetails } from "@/lib/api/types";
import { CardImage } from "@/components/card-image";
import { resolvePokemonDetails } from "@/lib/services/pokemon-details-resolver";

type Props = {
  setId: string;
  slot: PackSlot | null;
  onClose: () => void;
};

export function CardDetailsModal({ setId, slot, onClose }: Props) {
  const [details, setDetails] = useState<ResolvedPokemonDetails | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!slot) return;
    let active = true;
    setIsLoading(true);
    setErrorMessage(null);
    setDetails(null);

    void resolvePokemonDetails({
      setId,
      cardId: slot.card_id,
      cardName: slot.card_name
    })
      .then((resolved) => {
        if (!active) return;
        setDetails(resolved);
      })
      .catch((error) => {
        if (!active) return;
        setErrorMessage(error instanceof Error ? error.message : "Failed to load card details.");
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [setId, slot]);

  useEffect(() => {
    if (!slot) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, slot]);

  if (!slot) return null;
  const displayName = details?.name || slot.card_name || (isLoading ? "Loading card..." : "Unknown Card");
  const collectionBadge = slot.is_new ? "NEW" : slot.is_duplicate ? "DUPLICATE" : "OWNED";
  const collectionBadgeClass = slot.is_new
    ? "chip--ok"
    : slot.is_duplicate
      ? "chip--warn"
      : "chip--mute";

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label="Card details">
      <article className="card-modal" onClick={(event) => event.stopPropagation()}>
        <section className="card-modal__left">
          <CardImage
            setId={setId}
            cardId={slot.card_id}
            cardName={displayName}
            rarity={slot.rarity}
            badgeLabel={collectionBadge}
            className="card-modal__image"
            hideCardId
          />
        </section>
        <section className="card-modal__right">
          <div className="card-modal__title-row">
            <h3>{displayName}</h3>
            <button className="btn btn--ghost" onClick={onClose} aria-label="Close details">
              Close
            </button>
          </div>

          <div className="card-modal__badge-row">
            <span className="chip">{slot.rarity}</span>
            <span className={`chip ${collectionBadgeClass}`}>
              {collectionBadge}
            </span>
          </div>

          {isLoading && <p className="empty-state">Loading Pokemon details...</p>}
          {errorMessage && <p className="error-banner">{errorMessage}</p>}
          {!isLoading && !errorMessage && details && (
            <div className="card-modal__sections">
              <section className="card-modal__section">
                <h4>Pokemon Info</h4>
                <div className="card-modal__kv-grid">
                  <div className="card-modal__kv">
                    <span className="card-modal__label">Dex Number</span>
                    <span className="card-modal__value">{details.dexNumber ?? "N/A"}</span>
                  </div>
                  <div className="card-modal__kv">
                    <span className="card-modal__label">Name</span>
                    <span className="card-modal__value">{details.name || "N/A"}</span>
                  </div>
                </div>
              </section>

              <section className="card-modal__section">
                <h4>Combat Data</h4>
                <div className="card-modal__pill-row">
                  <span className="card-modal__label">Type</span>
                  {details.types.length ? (
                    details.types.map((typeName) => (
                      <span className="chip card-modal__pill" key={`type-${typeName}`}>
                        {typeName}
                      </span>
                    ))
                  ) : (
                    <span className="card-modal__value">N/A</span>
                  )}
                </div>
                <div className="card-modal__pill-row">
                  <span className="card-modal__label">Weakness</span>
                  {details.weaknesses.length ? (
                    details.weaknesses.map((weakness) => (
                      <span className="chip card-modal__pill card-modal__pill--warn" key={`weak-${weakness}`}>
                        {weakness}
                      </span>
                    ))
                  ) : (
                    <span className="card-modal__value">N/A</span>
                  )}
                </div>
              </section>

              <section className="card-modal__section">
                <h4>Description</h4>
                <p className="card-modal__description">{details.description || "No description available."}</p>
              </section>
            </div>
          )}
        </section>
      </article>
    </div>
  );
}
