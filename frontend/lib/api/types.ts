export type Rarity = "common" | "uncommon" | "rare" | "holo";

export type PackSlot = {
  slot_index: number;
  slot_type: "rare" | "uncommon" | "common";
  rarity: Rarity;
  card_id: string;
  card_name?: string;
  is_new: boolean;
  is_duplicate: boolean;
};

export type PackResult = {
  set_id: string;
  seed?: number | null;
  config: {
    rare_slots: number;
    uncommon_slots: number;
    common_slots: number;
    holo_upgrade_chance: number;
    allow_duplicates_within_pack: boolean;
    pity_after_packs?: number | null;
  };
  debug?: {
    pools_dir?: string;
    holo_upgrade_probability: number;
    rare_slot_rolls: Array<{
      rare_slot_index: number;
      roll: number;
      threshold: number;
      upgraded_to_holo: boolean;
    }>;
  };
  slots: PackSlot[];
  summary: {
    total_cards: number;
    pack_size?: number;
    new_cards: number;
    duplicate_cards: number;
  };
};

export type PackConfig = Partial<PackResult["config"]>;

export type BinderUpdateSummary = {
  set_id: string;
  total_slots_processed: number;
  cards_written: number;
  new_discoveries: number;
  duplicate_increments: number;
  invalid_card_ids: string[];
  set_completed: boolean;
  newly_unlocked_sets: string[];
};

export type CollectionProgress = {
  set_id: string;
  owned_unique: number;
  total_available: number;
  completion_percentage: number;
  remaining: number;
  is_complete: boolean;
};

export type GlobalProgress = {
  owned_unique: number;
  total_available: number;
  completion_percentage: number;
  remaining: number;
  per_set: Record<string, CollectionProgress>;
};

export type BinderRecord = {
  card_id: string;
  set_id: string;
  quantity_owned: number;
  first_obtained_at: string;
  last_obtained_at: string;
  ever_new_discovery: boolean;
};

export type BinderState = {
  version: number;
  cards: Record<string, BinderRecord>;
  unlocked_sets: string[];
  set_milestones: Record<string, number[]>;
  events: Array<{
    key: string;
    type: string;
    set_id?: string | null;
    timestamp: string;
    details?: Record<string, unknown>;
  }>;
  pack_history: unknown[];
};

export type SetCatalog = {
  set_id: string;
  cards: Array<{
    card_id: string;
    rarity: Rarity;
    image_url: string;
  }>;
};

export type OpenPackRequest = {
  setId: string;
  config?: PackConfig;
};

export type CardMetadata = {
  set_id: string;
  card_id: string;
  name: string | null;
  category: string | null;
  dex_id: number | null;
  description: string | null;
  types: string[];
  weaknesses: string[];
  rarity: string | null;
};

export type ResolvedPokemonDetails = {
  dexNumber: number | null;
  name: string;
  description: string | null;
  types: string[];
  weaknesses: string[];
  source: "local" | "api" | "local-trainer";
};
