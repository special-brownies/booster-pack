import { Rarity } from "@/lib/api/types";

export function getRarityGlowClass(rarity: Rarity | string): string {
  if (rarity === "holo") return "rarity-glow-holo";
  if (rarity === "rare") return "rarity-glow-rare";
  if (rarity === "uncommon") return "rarity-glow-uncommon";
  return "rarity-glow-common";
}
