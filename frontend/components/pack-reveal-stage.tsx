"use client";

import { motion, AnimatePresence } from "framer-motion";
import clsx from "clsx";
import { useCallback, useEffect, useMemo, useState } from "react";
import { PackResult } from "@/lib/api/types";
import { useAppState } from "@/lib/state/app-state";
import { useSfx } from "@/lib/hooks/use-sfx";
import { CardImage } from "@/components/card-image";
import { RevealMode, useRevealController } from "@/lib/hooks/use-reveal-controller";
import { CardDetailsModal } from "@/components/card-details-modal";

type Props = {
  pack: PackResult | null;
  onRevealComplete: () => Promise<void>;
};

function rarityClass(rarity: string): string {
  if (rarity === "holo") return "rarity-holo";
  if (rarity === "rare") return "rarity-rare";
  if (rarity === "uncommon") return "rarity-uncommon";
  return "rarity-common";
}

export function PackRevealStage({ pack, onRevealComplete }: Props) {
  const { state } = useAppState();
  const { playCardFlip, playCelebrate } = useSfx();
  const [mode, setMode] = useState<RevealMode>("manual");
  const [zoomedSlotIndex, setZoomedSlotIndex] = useState<number | null>(null);
  const hasPack = !!pack;
  const setId = pack?.set_id ?? "";
  const slots = pack?.slots ?? [];
  const total = slots.length;
  const autoDelayMs = Number(process.env.NEXT_PUBLIC_AUTO_REVEAL_DELAY_MS ?? 700);

  const handleAllRevealed = useCallback(async () => {
    if (!hasPack) return;
    console.info("[Reveal] all cards revealed; binder update starting", {
      setId,
      totalCards: total
    });
    await onRevealComplete();
    playCelebrate();
  }, [hasPack, onRevealComplete, playCelebrate, setId, total]);

  const controller = useRevealController({
    totalCards: total,
    mode,
    autoDelayMs,
    onAllRevealed: handleAllRevealed
  });

  const visible = useMemo(() => slots.slice(0, controller.visibleCount), [controller.visibleCount, slots]);

  useEffect(() => {
    if (!hasPack) return;
    console.info("[Reveal] pack ready", { setId, totalCards: total });
  }, [hasPack, setId, total]);

  useEffect(() => {
    if (!hasPack) {
      setZoomedSlotIndex(null);
    }
  }, [hasPack]);

  useEffect(() => {
    if (!state.reducedMotion) return;
    if (controller.phase !== "flipping") return;
    const timer = window.setTimeout(() => controller.onFlipAnimationComplete(), 30);
    return () => window.clearTimeout(timer);
  }, [controller.onFlipAnimationComplete, controller.phase, state.reducedMotion]);

  const handleNext = () => {
    if (!controller.canAdvance) return;
    playCardFlip();
    console.info("[Reveal] advance", {
      from: controller.currentIndex,
      to: controller.currentIndex + 1
    });
    controller.revealNext();
  };

  if (!hasPack) return null;

  const zoomedSlot = typeof zoomedSlotIndex === "number" ? visible[zoomedSlotIndex] ?? null : null;

  return (
    <section className="reveal-stage" aria-live="polite" aria-label="Pack reveal">
      <div className="reveal-stage__header">
        <h2>Reveal</h2>
        <div className="reveal-mode">
          <button
            className={clsx("btn btn--ghost reveal-mode__btn", mode === "manual" && "reveal-mode__btn--active")}
            onClick={() => setMode("manual")}
            aria-pressed={mode === "manual"}
          >
            Manual
          </button>
          <button
            className={clsx("btn btn--ghost reveal-mode__btn", mode === "auto" && "reveal-mode__btn--active")}
            onClick={() => setMode("auto")}
            aria-pressed={mode === "auto"}
          >
            Auto
          </button>
        </div>
        <p>
          Card {Math.max(0, Math.min(controller.currentIndex + 1, total))} of {total}
        </p>
      </div>

      <div className="reveal-grid">
        <AnimatePresence>
          {visible.map((slot) => (
            <motion.article
              key={`${slot.slot_index}-${slot.card_id}-${controller.currentIndex}`}
              initial={state.reducedMotion ? false : { opacity: 0, y: 16, rotateY: -90 }}
              animate={state.reducedMotion ? { opacity: 1 } : { opacity: 1, y: 0, rotateY: 0 }}
              exit={state.reducedMotion ? { opacity: 0 } : { opacity: 0, y: -12 }}
              transition={{ duration: state.reducedMotion ? 0.1 : 0.35 }}
              className={clsx("card-tile", rarityClass(slot.rarity))}
              onAnimationComplete={() => {
                const logicalIndex = slot.slot_index - 1;
                if (logicalIndex === controller.currentIndex) {
                  controller.onFlipAnimationComplete();
                }
              }}
            >
              <button
                className="card-tile__clickable"
                onClick={() => setZoomedSlotIndex(slot.slot_index - 1)}
                aria-label={`Open details for ${slot.card_name || "Unknown Card"}`}
              >
                <div className="card-tile__media">
                  <CardImage
                    setId={setId}
                    cardId={slot.card_id}
                    cardName={slot.card_name}
                    rarity={slot.rarity}
                    badgeLabel={slot.is_new ? "NEW" : "DUPLICATE"}
                    className="card-tile__image"
                  />
                </div>
              </button>
              <div className="card-tile__text">
                <p className="card-tile__name">{slot.card_name || "Unknown Card"}</p>
                <p className="card-tile__id">{slot.card_id}</p>
              </div>
              <div className="card-tile__meta">
                <span className="chip">{slot.rarity}</span>
                <span className={clsx("chip", slot.is_new ? "chip--ok" : "chip--warn")}>
                  {slot.is_new ? "New" : "Duplicate"}
                </span>
              </div>
            </motion.article>
          ))}
        </AnimatePresence>
      </div>

      <CardDetailsModal setId={setId} slot={zoomedSlot} onClose={() => setZoomedSlotIndex(null)} />

      <div className="reveal-stage__actions">
        <button
          className="btn btn--primary"
          onClick={handleNext}
          disabled={!controller.canAdvance || state.ui.isUpdatingBinder}
        >
          {controller.isComplete
            ? state.ui.isUpdatingBinder
              ? "Syncing..."
              : "Pack Synced"
            : controller.currentIndex < 0
              ? "Start Reveal"
              : "Flip Next Card"}
        </button>
      </div>
    </section>
  );
}
