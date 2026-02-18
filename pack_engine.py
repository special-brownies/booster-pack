"""Backend pack opening engine for Pokemon TCG simulator."""

from __future__ import annotations

import json
import logging
import os
import random
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any


LOGGER = logging.getLogger(__name__)
PACK_SIZE = 10


def _resolve_default_metadata_dir() -> Path:
    configured = os.getenv("DATASET_PATH")
    if configured and configured.strip():
        return Path(configured).expanduser().resolve()
    return (Path.cwd() / "pokemon_series").resolve()


@dataclass(frozen=True)
class PackConfig:
    """Configurable pack structure and pull probabilities."""

    rare_slots: int = 1
    uncommon_slots: int = 3
    common_slots: int = 6
    holo_upgrade_chance: float = 1.0 / 3.0
    allow_duplicates_within_pack: bool = True
    pity_after_packs: int | None = None

    def validate(self) -> None:
        if self.rare_slots < 0 or self.uncommon_slots < 0 or self.common_slots < 0:
            raise ValueError("Slot counts must be non-negative integers.")
        slot_total = self.rare_slots + self.uncommon_slots + self.common_slots
        if slot_total != PACK_SIZE:
            raise ValueError(
                f"Pack must contain exactly {PACK_SIZE} cards, got {slot_total} "
                f"(rare={self.rare_slots}, uncommon={self.uncommon_slots}, common={self.common_slots})."
            )
        if not (0.0 <= self.holo_upgrade_chance <= 1.0):
            raise ValueError("holo_upgrade_chance must be between 0.0 and 1.0.")
        if self.pity_after_packs is not None and self.pity_after_packs <= 0:
            raise ValueError("pity_after_packs must be positive when provided.")


DEFAULT_CONFIG = PackConfig()


def _coerce_config(config: PackConfig | dict[str, Any] | None) -> PackConfig:
    if config is None:
        return DEFAULT_CONFIG
    if isinstance(config, PackConfig):
        return config
    if isinstance(config, dict):
        allowed_fields = {
            "rare_slots",
            "uncommon_slots",
            "common_slots",
            "holo_upgrade_chance",
            "allow_duplicates_within_pack",
            "pity_after_packs",
        }
        unknown = sorted(set(config.keys()) - allowed_fields)
        if unknown:
            raise ValueError(f"Unknown config fields: {unknown}")
        return PackConfig(**config)
    raise TypeError("config must be PackConfig, dict, or None")


def _normalize_binder_state(binder_state: Any, set_id: str) -> set[str]:
    if binder_state is None:
        return set()

    if isinstance(binder_state, dict):
        if "owned_card_ids" in binder_state:
            raw = binder_state["owned_card_ids"]
        elif set_id in binder_state and isinstance(binder_state[set_id], (list, tuple, set)):
            raw = binder_state[set_id]
        else:
            # Accept maps like {"base2-1": 2, "base2-2": 1} or bool flags.
            raw = [k for k, v in binder_state.items() if bool(v)]
        return {str(card_id) for card_id in raw}

    if isinstance(binder_state, (list, tuple, set)):
        return {str(card_id) for card_id in binder_state}

    raise TypeError("binder_state must be None, iterable of IDs, or mapping.")


def _load_pool(set_id: str, pools_dir: Path) -> dict[str, list[str]]:
    pool_file = pools_dir / f"{set_id}.json"
    if not pool_file.exists():
        raise FileNotFoundError(f"Pool file not found for set '{set_id}': {pool_file}")

    data = json.loads(pool_file.read_text(encoding="utf-8"))
    pools = data.get("pools")
    if not isinstance(pools, dict):
        raise ValueError(f"Invalid pool file format (missing 'pools'): {pool_file}")

    normalized: dict[str, list[str]] = {}
    for rarity in ("common", "uncommon", "rare", "holo"):
        values = pools.get(rarity, [])
        if not isinstance(values, list):
            raise ValueError(f"Invalid pool file format ('{rarity}' must be a list): {pool_file}")
        normalized[rarity] = [str(x) for x in values]
    return normalized


def _pick_from_pool(
    rarity: str,
    pool: list[str],
    rng: random.Random,
    used_in_pack: set[str],
    allow_duplicates_within_pack: bool,
) -> str:
    if not pool:
        raise ValueError(f"Pool '{rarity}' is empty.")

    if allow_duplicates_within_pack:
        return rng.choice(pool)

    available = [card_id for card_id in pool if card_id not in used_in_pack]
    if not available:
        raise ValueError(
            f"No available cards left in rarity '{rarity}' when duplicates are disallowed."
        )
    return rng.choice(available)


def _read_card_name(set_id: str, card_id: str, metadata_dir: Path) -> str:
    json_file = metadata_dir / set_id / f"{card_id}.json"
    if not json_file.exists():
        return card_id
    try:
        data = json.loads(json_file.read_text(encoding="utf-8"))
    except Exception:  # noqa: BLE001
        return card_id
    name = data.get("name")
    if isinstance(name, str) and name.strip():
        return name
    return card_id


def open_pack(
    set_id: str,
    config: PackConfig | dict[str, Any] | None = None,
    *,
    binder_state: Any = None,
    seed: int | None = None,
    pools_dir: str | Path = "pools",
    metadata_dir: str | Path | None = None,
) -> dict[str, Any]:
    """Open a simulated booster pack and return a JSON-serializable result."""

    if not set_id or not isinstance(set_id, str):
        raise ValueError("set_id must be a non-empty string.")

    final_config = _coerce_config(config)
    final_config.validate()

    pools_path = Path(pools_dir)
    metadata_path = Path(metadata_dir) if metadata_dir is not None else _resolve_default_metadata_dir()
    pools = _load_pool(set_id=set_id, pools_dir=pools_path)
    owned_cards = _normalize_binder_state(binder_state, set_id=set_id)
    rng = random.Random(seed)

    if final_config.pity_after_packs is not None:
        LOGGER.debug("Pity system configured but not yet active: pity_after_packs=%s", final_config.pity_after_packs)

    slots: list[dict[str, Any]] = []
    used_in_pack: set[str] = set()
    roll_debug: list[dict[str, Any]] = []
    slot_index = 1

    for rare_slot_idx in range(final_config.rare_slots):
        roll = rng.random()
        upgraded_to_holo = roll < final_config.holo_upgrade_chance and len(pools["holo"]) > 0
        rarity = "holo" if upgraded_to_holo else "rare"
        card_id = _pick_from_pool(
            rarity=rarity,
            pool=pools[rarity],
            rng=rng,
            used_in_pack=used_in_pack,
            allow_duplicates_within_pack=final_config.allow_duplicates_within_pack,
        )
        used_in_pack.add(card_id)
        is_new = card_id not in owned_cards
        card_name = _read_card_name(set_id=set_id, card_id=card_id, metadata_dir=metadata_path)
        slots.append(
            {
                "slot_index": slot_index,
                "slot_type": "rare",
                "rarity": rarity,
                "card_id": card_id,
                "card_name": card_name,
                "is_new": is_new,
                "is_duplicate": not is_new,
            }
        )
        roll_debug.append(
            {
                "rare_slot_index": rare_slot_idx + 1,
                "roll": round(roll, 6),
                "threshold": final_config.holo_upgrade_chance,
                "upgraded_to_holo": upgraded_to_holo,
            }
        )
        LOGGER.debug(
            "Rare slot %s roll=%s threshold=%s upgraded_to_holo=%s chosen=%s",
            rare_slot_idx + 1,
            round(roll, 6),
            final_config.holo_upgrade_chance,
            upgraded_to_holo,
            card_id,
        )
        slot_index += 1

    for _ in range(final_config.uncommon_slots):
        card_id = _pick_from_pool(
            rarity="uncommon",
            pool=pools["uncommon"],
            rng=rng,
            used_in_pack=used_in_pack,
            allow_duplicates_within_pack=final_config.allow_duplicates_within_pack,
        )
        used_in_pack.add(card_id)
        is_new = card_id not in owned_cards
        card_name = _read_card_name(set_id=set_id, card_id=card_id, metadata_dir=metadata_path)
        slots.append(
            {
                "slot_index": slot_index,
                "slot_type": "uncommon",
                "rarity": "uncommon",
                "card_id": card_id,
                "card_name": card_name,
                "is_new": is_new,
                "is_duplicate": not is_new,
            }
        )
        LOGGER.debug("Uncommon slot %s chosen=%s", slot_index, card_id)
        slot_index += 1

    for _ in range(final_config.common_slots):
        card_id = _pick_from_pool(
            rarity="common",
            pool=pools["common"],
            rng=rng,
            used_in_pack=used_in_pack,
            allow_duplicates_within_pack=final_config.allow_duplicates_within_pack,
        )
        used_in_pack.add(card_id)
        is_new = card_id not in owned_cards
        card_name = _read_card_name(set_id=set_id, card_id=card_id, metadata_dir=metadata_path)
        slots.append(
            {
                "slot_index": slot_index,
                "slot_type": "common",
                "rarity": "common",
                "card_id": card_id,
                "card_name": card_name,
                "is_new": is_new,
                "is_duplicate": not is_new,
            }
        )
        LOGGER.debug("Common slot %s chosen=%s", slot_index, card_id)
        slot_index += 1

    new_cards = sum(1 for slot in slots if slot["is_new"])
    duplicate_cards = len(slots) - new_cards

    pack_size = len(slots)
    if pack_size != PACK_SIZE:
        raise ValueError(
            f"Pack size invariant violated: expected {PACK_SIZE}, got {pack_size} for set {set_id}."
        )
    LOGGER.info("Generated pack set=%s size=%s seed=%s", set_id, pack_size, seed)

    result = {
        "set_id": set_id,
        "seed": seed,
        "config": asdict(final_config),
        "debug": {
            "pools_dir": str(pools_path),
            "holo_upgrade_probability": final_config.holo_upgrade_chance,
            "rare_slot_rolls": roll_debug,
        },
        "slots": slots,
        "summary": {
            "total_cards": pack_size,
            "pack_size": pack_size,
            "new_cards": new_cards,
            "duplicate_cards": duplicate_cards,
        },
    }
    return result


def openPack(setId: str, config: PackConfig | dict[str, Any] | None = None, **kwargs: Any) -> dict[str, Any]:
    """Alias for open_pack to match camelCase API naming."""

    return open_pack(set_id=setId, config=config, **kwargs)
