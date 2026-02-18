"use client";

import { getSetDisplayName } from "@/lib/utils/set-labels";

type Props = {
  setId: string;
  query: string;
  rarity: "all" | "common" | "uncommon" | "rare" | "holo";
  ownership: "all" | "owned" | "missing";
  onSetIdChange: (value: string) => void;
  onQueryChange: (value: string) => void;
  onRarityChange: (value: Props["rarity"]) => void;
  onOwnershipChange: (value: Props["ownership"]) => void;
  setOptions: string[];
};

export function BinderFilters({
  setId,
  query,
  rarity,
  ownership,
  onSetIdChange,
  onQueryChange,
  onRarityChange,
  onOwnershipChange,
  setOptions
}: Props) {
  return (
    <section className="binder-filters" aria-label="Binder filters">
      <label>
        Set
        <select value={setId} onChange={(event) => onSetIdChange(event.target.value)}>
          {setOptions.map((option) => (
            <option key={option} value={option}>
              {getSetDisplayName(option)}
            </option>
          ))}
        </select>
      </label>

      <label>
        Search
        <input
          type="search"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Card name or ID..."
        />
      </label>

      <label>
        Rarity
        <select value={rarity} onChange={(event) => onRarityChange(event.target.value as Props["rarity"])}>
          <option value="all">All</option>
          <option value="common">Common</option>
          <option value="uncommon">Uncommon</option>
          <option value="rare">Rare</option>
          <option value="holo">Holo</option>
        </select>
      </label>

      <label>
        Ownership
        <select
          value={ownership}
          onChange={(event) => onOwnershipChange(event.target.value as Props["ownership"])}
        >
          <option value="all">All</option>
          <option value="owned">Owned</option>
          <option value="missing">Missing</option>
        </select>
      </label>
    </section>
  );
}
