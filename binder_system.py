"""Binder persistence and progression system for Pokemon TCG pack simulator."""

from __future__ import annotations

import json
import logging
import os
import tempfile
import copy
from abc import ABC, abstractmethod
from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


LOGGER = logging.getLogger(__name__)

DEFAULT_PROGRESSION_ORDER = ["base2", "jungle", "fossil", "base3", "base4", "base5"]
DEFAULT_MILESTONE_THRESHOLDS = [25, 50, 75, 100]


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def load_progression_config(config_path: str | Path = "config/progression.json") -> dict[str, Any]:
    """Load progression configuration with resilient defaults."""

    path = Path(config_path)
    default = {
        "progression_order": list(DEFAULT_PROGRESSION_ORDER),
        "track_partial_milestones": True,
        "milestone_thresholds": list(DEFAULT_MILESTONE_THRESHOLDS),
        "maintain_pack_history": False,
    }
    if not path.exists():
        return default

    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:  # noqa: BLE001
        LOGGER.warning("Failed to parse progression config (%s): %s. Using defaults.", path, exc)
        return default

    if not isinstance(raw, dict):
        LOGGER.warning("Progression config must be an object. Using defaults.")
        return default

    progression_order = raw.get("progression_order", default["progression_order"])
    if not isinstance(progression_order, list) or not all(
        isinstance(x, str) and x.strip() for x in progression_order
    ):
        progression_order = default["progression_order"]

    track_partial = raw.get("track_partial_milestones", default["track_partial_milestones"])
    if not isinstance(track_partial, bool):
        track_partial = default["track_partial_milestones"]

    milestones = raw.get("milestone_thresholds", default["milestone_thresholds"])
    if not isinstance(milestones, list) or not all(
        isinstance(x, int) and 0 < x <= 100 for x in milestones
    ):
        milestones = default["milestone_thresholds"]
    milestones = sorted(set(milestones))

    maintain_pack_history = raw.get("maintain_pack_history", default["maintain_pack_history"])
    if not isinstance(maintain_pack_history, bool):
        maintain_pack_history = default["maintain_pack_history"]

    return {
        "progression_order": progression_order,
        "track_partial_milestones": track_partial,
        "milestone_thresholds": milestones,
        "maintain_pack_history": maintain_pack_history,
    }


@dataclass
class CardRecord:
    card_id: str
    set_id: str
    quantity_owned: int
    first_obtained_at: str
    last_obtained_at: str
    ever_new_discovery: bool

    def to_dict(self) -> dict[str, Any]:
        return {
            "card_id": self.card_id,
            "set_id": self.set_id,
            "quantity_owned": self.quantity_owned,
            "first_obtained_at": self.first_obtained_at,
            "last_obtained_at": self.last_obtained_at,
            "ever_new_discovery": self.ever_new_discovery,
        }


class BinderRepository(ABC):
    """Persistence abstraction to allow swapping storage implementation."""

    @abstractmethod
    def load(self) -> dict[str, Any]:
        raise NotImplementedError

    @abstractmethod
    def save(self, state: dict[str, Any]) -> None:
        raise NotImplementedError


class JsonBinderRepository(BinderRepository):
    """JSON-file persistence with atomic writes."""

    def __init__(self, file_path: str | Path = "data/binder_state.json") -> None:
        self.file_path = Path(file_path)

    def load(self) -> dict[str, Any]:
        if not self.file_path.exists():
            LOGGER.info("Binder file missing. Initializing empty binder at %s", self.file_path)
            return {}

        try:
            data = json.loads(self.file_path.read_text(encoding="utf-8"))
        except Exception as exc:  # noqa: BLE001
            LOGGER.error(
                "Binder file is unreadable/corrupted (%s): %s. Reinitializing empty binder.",
                self.file_path,
                exc,
            )
            return {}

        if not isinstance(data, dict):
            LOGGER.error("Binder file root is invalid. Reinitializing empty binder.")
            return {}
        return data

    def save(self, state: dict[str, Any]) -> None:
        self.file_path.parent.mkdir(parents=True, exist_ok=True)
        payload = json.dumps(state, indent=2) + "\n"
        with tempfile.NamedTemporaryFile(
            "w", delete=False, encoding="utf-8", dir=self.file_path.parent, suffix=".tmp"
        ) as tmp:
            tmp.write(payload)
            temp_name = tmp.name
        os.replace(temp_name, self.file_path)


class CardCatalog:
    """In-memory card index derived from pool files for validation/progress."""

    def __init__(self, pools_dir: str | Path = "pools") -> None:
        self.pools_dir = Path(pools_dir)
        self.cards_by_set: dict[str, set[str]] = {}
        self.card_to_sets: dict[str, set[str]] = defaultdict(set)
        self.total_cards_by_set: dict[str, int] = {}
        self._load()

    def _load(self) -> None:
        if not self.pools_dir.exists():
            raise FileNotFoundError(f"Pools directory not found: {self.pools_dir}")

        for pool_file in sorted(self.pools_dir.glob("*.json"), key=lambda p: p.name):
            raw = json.loads(pool_file.read_text(encoding="utf-8"))
            set_id = raw.get("set_id") or pool_file.stem
            pools = raw.get("pools", {})
            card_ids: set[str] = set()
            for rarity in ("common", "uncommon", "rare", "holo"):
                items = pools.get(rarity, [])
                if isinstance(items, list):
                    card_ids.update(str(x) for x in items)
            self.cards_by_set[set_id] = card_ids
            self.total_cards_by_set[set_id] = len(card_ids)
            for card_id in card_ids:
                self.card_to_sets[card_id].add(set_id)

    def is_known_set(self, set_id: str) -> bool:
        return set_id in self.cards_by_set

    def is_known_card(self, card_id: str) -> bool:
        return card_id in self.card_to_sets

    def is_known_card_in_set(self, card_id: str, set_id: str) -> bool:
        return card_id in self.cards_by_set.get(set_id, set())

    def candidate_sets_for_card(self, card_id: str) -> set[str]:
        return set(self.card_to_sets.get(card_id, set()))


def _compose_card_key(set_id: str, card_id: str) -> str:
    return f"{set_id}::{card_id}"


class BinderService:
    """Core business logic for binder persistence, progress, and progression unlocks."""

    def __init__(
        self,
        repository: BinderRepository,
        catalog: CardCatalog,
        progression_config: dict[str, Any] | None = None,
    ) -> None:
        self.repository = repository
        self.catalog = catalog
        self.progression_config = progression_config or load_progression_config()
        self.progression_order = list(self.progression_config["progression_order"])
        self.track_partial_milestones = bool(self.progression_config["track_partial_milestones"])
        self.milestone_thresholds = list(self.progression_config["milestone_thresholds"])
        self.maintain_pack_history = bool(self.progression_config["maintain_pack_history"])

        self.state = self._validate_or_initialize_state(self.repository.load())
        self._rebuild_indexes()
        self._ensure_initial_unlock()
        self._persist()

    def _validate_or_initialize_state(self, raw: dict[str, Any]) -> dict[str, Any]:
        empty = {
            "version": 1,
            "cards": {},
            "unlocked_sets": [],
            "set_milestones": {},
            "events": [],
            "pack_history": [],
        }
        if not raw:
            return empty

        state = dict(empty)
        state["version"] = raw.get("version", 1)
        state["cards"] = {}
        state["unlocked_sets"] = []
        state["set_milestones"] = {}
        state["events"] = []
        state["pack_history"] = []

        cards = raw.get("cards", {})
        if isinstance(cards, dict):
            for key, rec in cards.items():
                validated = self._validate_card_record(key, rec)
                if validated:
                    state["cards"][key] = validated.to_dict()

        unlocked_sets = raw.get("unlocked_sets", [])
        if isinstance(unlocked_sets, list):
            state["unlocked_sets"] = [
                set_id
                for set_id in unlocked_sets
                if isinstance(set_id, str) and self.catalog.is_known_set(set_id)
            ]

        set_milestones = raw.get("set_milestones", {})
        if isinstance(set_milestones, dict):
            for set_id, values in set_milestones.items():
                if not isinstance(set_id, str) or not self.catalog.is_known_set(set_id):
                    continue
                if isinstance(values, list):
                    valid_values = sorted(
                        {
                            int(v)
                            for v in values
                            if isinstance(v, int) and 0 < v <= 100
                        }
                    )
                    state["set_milestones"][set_id] = valid_values

        events = raw.get("events", [])
        if isinstance(events, list):
            for item in events:
                if isinstance(item, dict):
                    event_type = item.get("type")
                    timestamp = item.get("timestamp")
                    if isinstance(event_type, str) and isinstance(timestamp, str):
                        state["events"].append(item)

        if self.maintain_pack_history:
            pack_history = raw.get("pack_history", [])
            if isinstance(pack_history, list):
                state["pack_history"] = pack_history

        return state

    def _validate_card_record(self, key: str, rec: Any) -> CardRecord | None:
        if not isinstance(key, str) or not isinstance(rec, dict):
            return None
        card_id = rec.get("card_id")
        set_id = rec.get("set_id")
        quantity_owned = rec.get("quantity_owned")
        first_obtained_at = rec.get("first_obtained_at")
        last_obtained_at = rec.get("last_obtained_at")
        ever_new_discovery = rec.get("ever_new_discovery")
        if not isinstance(card_id, str) or not card_id:
            return None
        if not isinstance(set_id, str) or not self.catalog.is_known_set(set_id):
            return None
        if not self.catalog.is_known_card_in_set(card_id, set_id):
            return None
        expected_key = _compose_card_key(set_id, card_id)
        if key != expected_key:
            return None
        if not isinstance(quantity_owned, int) or quantity_owned < 0:
            return None
        if not isinstance(first_obtained_at, str) or not isinstance(last_obtained_at, str):
            return None
        if not isinstance(ever_new_discovery, bool):
            return None
        return CardRecord(
            card_id=card_id,
            set_id=set_id,
            quantity_owned=quantity_owned,
            first_obtained_at=first_obtained_at,
            last_obtained_at=last_obtained_at,
            ever_new_discovery=ever_new_discovery,
        )

    def _rebuild_indexes(self) -> None:
        self.owned_unique_by_set: dict[str, set[str]] = defaultdict(set)
        for rec in self.state["cards"].values():
            card_id = rec["card_id"]
            if rec["quantity_owned"] > 0:
                self.owned_unique_by_set[rec["set_id"]].add(card_id)

    def _persist(self) -> None:
        self.repository.save(self.state)

    def _ensure_initial_unlock(self) -> None:
        if not self.progression_order:
            return
        first_set = self.progression_order[0]
        if first_set not in self.state["unlocked_sets"]:
            self.state["unlocked_sets"].append(first_set)
            self._log_event(
                event_type="INITIAL_SET_UNLOCKED",
                set_id=first_set,
                details={"reason": "first_set_in_progression"},
            )

    def _event_key(self, event_type: str, set_id: str | None, details: dict[str, Any] | None) -> str:
        next_set = ""
        threshold = ""
        if details and isinstance(details.get("next_set_id"), str):
            next_set = details["next_set_id"]
        if details and isinstance(details.get("threshold"), int):
            threshold = str(details["threshold"])
        return f"{event_type}:{set_id or ''}:{next_set}:{threshold}"

    def _log_event(
        self,
        *,
        event_type: str,
        set_id: str | None = None,
        details: dict[str, Any] | None = None,
    ) -> None:
        details = details or {}
        key = self._event_key(event_type, set_id, details)
        existing_keys = {str(evt.get("key", "")) for evt in self.state["events"]}
        if key in existing_keys:
            return
        payload = {
            "key": key,
            "type": event_type,
            "set_id": set_id,
            "timestamp": _utc_now_iso(),
            "details": details,
        }
        self.state["events"].append(payload)
        LOGGER.info("milestone_event=%s", payload)

    def add_cards_to_binder(self, pack_result: dict[str, Any]) -> dict[str, Any]:
        if not isinstance(pack_result, dict):
            raise TypeError("pack_result must be a dictionary.")
        pack_set_id = pack_result.get("set_id")
        if not isinstance(pack_set_id, str) or not self.catalog.is_known_set(pack_set_id):
            raise ValueError("pack_result.set_id is missing or unknown.")
        slots = pack_result.get("slots")
        if not isinstance(slots, list):
            raise ValueError("pack_result.slots must be a list.")

        timestamp = _utc_now_iso()
        inserted_new = 0
        incremented_duplicates = 0
        invalid_card_ids: list[str] = []
        updated_card_ids: list[str] = []

        for slot in slots:
            if not isinstance(slot, dict):
                continue
            raw_card_id = slot.get("card_id")
            if not isinstance(raw_card_id, str) or not raw_card_id:
                invalid_card_ids.append(str(raw_card_id))
                LOGGER.warning("Skipping invalid card entry in pack slot: %s", slot)
                continue

            card_id = raw_card_id.strip()
            if not self.catalog.is_known_card(card_id):
                invalid_card_ids.append(card_id)
                LOGGER.warning("Skipping unknown card id from pack: %s", card_id)
                continue
            if not self.catalog.is_known_card_in_set(card_id, pack_set_id):
                invalid_card_ids.append(card_id)
                candidates = sorted(self.catalog.candidate_sets_for_card(card_id))
                LOGGER.warning(
                    "Skipping card id not present in pack set: card=%s expected_set=%s candidate_sets=%s",
                    card_id,
                    pack_set_id,
                    candidates,
                )
                continue

            record_key = _compose_card_key(pack_set_id, card_id)
            existing = self.state["cards"].get(record_key)
            if existing is None:
                record = CardRecord(
                    card_id=card_id,
                    set_id=pack_set_id,
                    quantity_owned=1,
                    first_obtained_at=timestamp,
                    last_obtained_at=timestamp,
                    ever_new_discovery=True,
                )
                self.state["cards"][record_key] = record.to_dict()
                self.owned_unique_by_set[pack_set_id].add(card_id)
                inserted_new += 1
                LOGGER.info("binder_update=new_card card_id=%s set_id=%s", card_id, pack_set_id)
            else:
                existing["quantity_owned"] += 1
                existing["last_obtained_at"] = timestamp
                if not isinstance(existing.get("ever_new_discovery"), bool):
                    existing["ever_new_discovery"] = True
                incremented_duplicates += 1
                LOGGER.info(
                    "binder_update=duplicate_increment card_id=%s quantity_owned=%s",
                    card_id,
                    existing["quantity_owned"],
                )
            updated_card_ids.append(card_id)

        progression_updates = self._evaluate_progression(changed_set_ids={pack_set_id})
        if self.track_partial_milestones:
            self._update_partial_milestones(pack_set_id)

        if self.maintain_pack_history:
            self.state["pack_history"].append(
                {
                    "timestamp": timestamp,
                    "set_id": pack_set_id,
                    "cards_added": list(updated_card_ids),
                    "invalid_card_ids": list(invalid_card_ids),
                }
            )

        self._persist()
        return {
            "set_id": pack_set_id,
            "total_slots_processed": len(slots),
            "cards_written": len(updated_card_ids),
            "new_discoveries": inserted_new,
            "duplicate_increments": incremented_duplicates,
            "invalid_card_ids": invalid_card_ids,
            "set_completed": self.is_set_complete(pack_set_id),
            "newly_unlocked_sets": progression_updates["newly_unlocked_sets"],
        }

    def _update_partial_milestones(self, set_id: str) -> None:
        progress = self.get_collection_progress(set_id)
        achieved = set(self.state["set_milestones"].get(set_id, []))
        percent = progress["completion_percentage"]
        for threshold in self.milestone_thresholds:
            if percent >= threshold and threshold not in achieved:
                achieved.add(threshold)
                self._log_event(
                    event_type="SET_MILESTONE_REACHED",
                    set_id=set_id,
                    details={"threshold": threshold, "completion_percentage": percent},
                )
        self.state["set_milestones"][set_id] = sorted(achieved)

    def _evaluate_progression(self, changed_set_ids: set[str] | None = None) -> dict[str, Any]:
        changed_set_ids = changed_set_ids or set()
        newly_unlocked_sets: list[str] = []

        for set_id in self.progression_order:
            if set_id in changed_set_ids and self.is_set_complete(set_id):
                self._log_event(event_type="SET_COMPLETED", set_id=set_id, details={})

        # Unlock next set for every completed set in order.
        for idx, set_id in enumerate(self.progression_order):
            if not self.is_set_complete(set_id):
                continue
            if idx + 1 >= len(self.progression_order):
                continue
            next_set = self.progression_order[idx + 1]
            if next_set not in self.state["unlocked_sets"]:
                self.state["unlocked_sets"].append(next_set)
                newly_unlocked_sets.append(next_set)
                self._log_event(
                    event_type="NEW_SET_UNLOCKED",
                    set_id=set_id,
                    details={"next_set_id": next_set},
                )
                LOGGER.info("progression_unlocked current_set=%s next_set=%s", set_id, next_set)

        return {"newly_unlocked_sets": newly_unlocked_sets}

    def get_collection_progress(self, set_id: str) -> dict[str, Any]:
        if not self.catalog.is_known_set(set_id):
            raise ValueError(f"Unknown set_id: {set_id}")
        owned_unique = len(self.owned_unique_by_set.get(set_id, set()))
        total_available = self.catalog.total_cards_by_set.get(set_id, 0)
        remaining = max(total_available - owned_unique, 0)
        completion = (owned_unique / total_available * 100.0) if total_available else 0.0
        report = {
            "set_id": set_id,
            "owned_unique": owned_unique,
            "total_available": total_available,
            "completion_percentage": round(completion, 2),
            "remaining": remaining,
            "is_complete": remaining == 0 and total_available > 0,
        }
        LOGGER.info("set_progress_check=%s", report)
        return report

    def get_global_progress(self) -> dict[str, Any]:
        all_owned = 0
        all_total = 0
        per_set: dict[str, dict[str, Any]] = {}
        for set_id in sorted(self.catalog.cards_by_set.keys()):
            report = self.get_collection_progress(set_id)
            per_set[set_id] = report
            all_owned += report["owned_unique"]
            all_total += report["total_available"]
        remaining = max(all_total - all_owned, 0)
        completion = (all_owned / all_total * 100.0) if all_total else 0.0
        return {
            "owned_unique": all_owned,
            "total_available": all_total,
            "completion_percentage": round(completion, 2),
            "remaining": remaining,
            "per_set": per_set,
        }

    def is_set_complete(self, set_id: str) -> bool:
        return self.get_collection_progress(set_id)["is_complete"]

    def get_unlocked_sets(self) -> list[str]:
        ordered = [set_id for set_id in self.progression_order if set_id in self.state["unlocked_sets"]]
        extras = sorted(set(self.state["unlocked_sets"]) - set(ordered))
        return ordered + extras

    def is_set_unlocked(self, set_id: str) -> bool:
        return set_id in self.state["unlocked_sets"]

    def get_binder_state(self) -> dict[str, Any]:
        return copy.deepcopy(self.state)


def create_default_binder_service(
    *,
    pools_dir: str | Path = "pools",
    binder_file: str | Path = "data/binder_state.json",
    progression_config_path: str | Path = "config/progression.json",
) -> BinderService:
    """Factory for standard single-user local setup."""

    catalog = CardCatalog(pools_dir=pools_dir)
    repository = JsonBinderRepository(file_path=binder_file)
    progression_config = load_progression_config(config_path=progression_config_path)
    return BinderService(
        repository=repository,
        catalog=catalog,
        progression_config=progression_config,
    )
