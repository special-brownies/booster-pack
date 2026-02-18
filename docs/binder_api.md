# Binder Persistence and Progression API

## Core Types

`CardRecord` fields:
- `card_id: str`
- `set_id: str`
- `quantity_owned: int`
- `first_obtained_at: str` (ISO 8601 UTC)
- `last_obtained_at: str` (ISO 8601 UTC)
- `ever_new_discovery: bool`

## Public Entry Points

`create_default_binder_service(pools_dir="pools", binder_file="data/binder_state.json", progression_config_path="config/progression.json") -> BinderService`

`BinderService.add_cards_to_binder(pack_result: dict) -> dict`
- Validates `pack_result.set_id` and `pack_result.slots[*].card_id`.
- Unknown/corrupted card IDs are skipped and returned in `invalid_card_ids`.
- New cards create one `CardRecord`; duplicates increment `quantity_owned`.
- Updates progression/unlocks and persists atomically.

`BinderService.get_collection_progress(set_id: str) -> dict`
- Returns:
  - `set_id`
  - `owned_unique`
  - `total_available`
  - `completion_percentage`
  - `remaining`
  - `is_complete`

`BinderService.get_global_progress() -> dict`
- Aggregates all sets and returns global completion plus `per_set`.

`BinderService.is_set_complete(set_id: str) -> bool`

`BinderService.get_unlocked_sets() -> list[str]`

`BinderService.is_set_unlocked(set_id: str) -> bool`

`BinderService.get_binder_state() -> dict`

## Persistence

Storage file: `data/binder_state.json`  
Format (top-level):
- `version: int`
- `cards: { [card_id]: CardRecord }`
- `unlocked_sets: string[]`
- `set_milestones: { [set_id]: number[] }`
- `events: object[]`
- `pack_history: object[]` (used only if enabled by config)

Writes are atomic:
1. write JSON to temp file in target directory
2. replace target with temp via `os.replace`

## Configuration

File: `config/progression.json`
- `progression_order: string[]`
- `track_partial_milestones: boolean`
- `milestone_thresholds: number[]`
- `maintain_pack_history: boolean`
