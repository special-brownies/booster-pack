"use client";

import Pokedex from "pokedex-promise-v2";
import { apiClient } from "@/lib/api/client";
import { CardMetadata, ResolvedPokemonDetails } from "@/lib/api/types";

const detailsCache = new Map<string, ResolvedPokemonDetails>();
const metadataCache = new Map<string, CardMetadata>();
const pokedex = new Pokedex();

type ResolveInput = {
  setId: string;
  cardId: string;
  cardName?: string | null;
};

function cacheKey(setId: string, cardId: string): string {
  return `${setId}::${cardId}`;
}

function lookupCacheKey(lookupKey: string | number): string {
  return String(lookupKey).toLowerCase();
}

function humanizeName(name: string): string {
  if (!name) return "";
  return name
    .split(/[-\s]+/g)
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ");
}

function extractFlavorText(species: any): string | null {
  const entries = Array.isArray(species?.flavor_text_entries) ? species.flavor_text_entries : [];
  const english = entries.find((x: any) => x?.language?.name === "en" && typeof x?.flavor_text === "string");
  if (!english?.flavor_text) return null;
  return String(english.flavor_text).replace(/\s+/g, " ").trim();
}

function hasLocalDetails(card: CardMetadata): boolean {
  return (
    Array.isArray(card.types) &&
    card.types.length > 0 &&
    Array.isArray(card.weaknesses) &&
    card.weaknesses.length > 0 &&
    typeof card.description === "string" &&
    card.description.trim().length > 0
  );
}

function normalizeLocalDetails(card: CardMetadata): ResolvedPokemonDetails {
  return {
    dexNumber: card.dex_id ?? null,
    name: card.name || card.card_id,
    description: card.description || null,
    types: card.types ?? [],
    weaknesses: card.weaknesses ?? [],
    source: card.category === "Pokemon" ? "local" : "local-trainer"
  };
}

async function normalizeApiDetails(apiPokemon: any): Promise<ResolvedPokemonDetails> {
  const species = await pokedex.getPokemonSpeciesByName(apiPokemon.id);
  const types = (apiPokemon.types || [])
    .map((x: any) => x?.type?.name)
    .filter((x: unknown): x is string => typeof x === "string");

  const typeDocs = await Promise.all(
  types.map((typeName: string) => pokedex.getTypeByName(typeName))
);

  const weaknessSet = new Set<string>();
  for (const doc of typeDocs) {
    const list = doc?.damage_relations?.double_damage_from ?? [];
    for (const type of list) {
      if (typeof type?.name === "string") weaknessSet.add(humanizeName(type.name));
    }
  }

  return {
    dexNumber: typeof apiPokemon.id === "number" ? apiPokemon.id : null,
    name: humanizeName(apiPokemon.name || ""),
    description: extractFlavorText(species),
    types: types.map(humanizeName),
    weaknesses: Array.from(weaknessSet),
    source: "api"
  };
}

async function getLocalMetadata(setId: string, cardId: string): Promise<CardMetadata> {
  const key = cacheKey(setId, cardId);
  const cached = metadataCache.get(key);
  if (cached) return cached;
  const data = await apiClient.getCardMetadata(setId, cardId);
  metadataCache.set(key, data);
  return data;
}

function resolveLookupKey(card: CardMetadata, fallbackName?: string | null): string | number | null {
  if (typeof card.dex_id === "number" && card.dex_id > 0) return card.dex_id;
  const candidate = card.name || fallbackName;
  if (!candidate || !candidate.trim()) return null;
  return candidate.trim().toLowerCase();
}

export async function resolvePokemonDetails(input: ResolveInput): Promise<ResolvedPokemonDetails> {
  if (!input || !input.setId || !input.cardId) {
    throw new Error("Invalid card");
  }

  const card = await getLocalMetadata(input.setId, input.cardId);
  const localResolved = normalizeLocalDetails(card);

  // Bypass non-Pokemon cards from external API path.
  if (card.category !== "Pokemon") {
    console.info("[Resolver] local-trainer bypass", { setId: input.setId, cardId: input.cardId });
    return localResolved;
  }

  if (hasLocalDetails(card)) {
    console.info("[Resolver] local-complete", { setId: input.setId, cardId: input.cardId });
    return localResolved;
  }

  const lookupKey = resolveLookupKey(card, input.cardName);
  if (lookupKey == null) {
    console.info("[Resolver] no-lookup-key fallback local", {
      setId: input.setId,
      cardId: input.cardId
    });
    return localResolved;
  }

  const key = lookupCacheKey(lookupKey);
  const cached = detailsCache.get(key);
  if (cached) {
    console.info("[Resolver] cache-hit", { lookupKey });
    return cached;
  }

  try {
    const pokemon = await pokedex.getPokemonByName(lookupKey as any);
    const normalized = await normalizeApiDetails(pokemon);
    detailsCache.set(key, normalized);
    console.info("[Resolver] api-fetch", { lookupKey, source: normalized.source });
    return normalized;
  } catch (error) {
    console.warn("[Resolver] api-fallback-local", {
      lookupKey,
      setId: input.setId,
      cardId: input.cardId,
      message: error instanceof Error ? error.message : "unknown error"
    });
    return localResolved;
  }
}

export function clearPokemonDetailsCache(): void {
  detailsCache.clear();
  metadataCache.clear();
}

