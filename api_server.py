"""HTTP API wrapper for pack engine + binder system.

Run:
  python -m uvicorn api_server:app --host 0.0.0.0 --port 8000 --reload
"""

from __future__ import annotations

import json
import logging
import os
import re
import threading
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel, ConfigDict

from binder_system import create_default_binder_service
from pack_engine import open_pack


logging.basicConfig(level=logging.INFO)
LOGGER = logging.getLogger("api_server")

POOLS_DIR = Path("pools")
DATA_DIR = Path("data")
DATA_DIR.mkdir(parents=True, exist_ok=True)


def _resolve_dataset_base_path() -> Path:
    configured = os.getenv("DATASET_PATH")
    if configured and configured.strip():
        return Path(configured).expanduser().resolve()
    return (Path.cwd() / "pokemon_series").resolve()


DATASET_BASE_PATH = _resolve_dataset_base_path()

app = FastAPI(title="Pokemon TCG Pack Simulator API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

_binder_lock = threading.Lock()
_binder_service = create_default_binder_service(
    pools_dir=POOLS_DIR, binder_file=DATA_DIR / "binder_state.json"
)


class OpenPackRequest(BaseModel):
    model_config = ConfigDict(extra="allow")

    setId: str | None = None
    set_id: str | None = None
    config: dict[str, Any] | None = None
    seed: int | None = None


class AddCardsRequest(BaseModel):
    model_config = ConfigDict(extra="allow")

    packResult: dict[str, Any] | None = None
    pack_result: dict[str, Any] | None = None


class SetCatalogCard(BaseModel):
    card_id: str
    rarity: str
    image_url: str


class SetCatalogResponse(BaseModel):
    set_id: str
    cards: list[SetCatalogCard]


class CardMetadataResponse(BaseModel):
    set_id: str
    card_id: str
    name: str | None = None
    category: str | None = None
    dex_id: int | None = None
    description: str | None = None
    types: list[str] = []
    weaknesses: list[str] = []
    rarity: str | None = None


def _extract_set_id(payload: OpenPackRequest) -> str:
    set_id = (payload.setId or payload.set_id or "").strip()
    if not set_id:
        raise HTTPException(status_code=400, detail="Missing setId/set_id")
    return set_id


def _extract_pack_result(payload: AddCardsRequest) -> dict[str, Any]:
    pack_result = payload.packResult or payload.pack_result
    if not isinstance(pack_result, dict):
        raise HTTPException(status_code=400, detail="Missing packResult/pack_result payload")
    return pack_result


def _build_set_catalog(set_id: str) -> SetCatalogResponse:
    pool_file = POOLS_DIR / f"{set_id}.json"
    if not pool_file.exists():
        raise HTTPException(status_code=404, detail=f"Set pool not found: {set_id}")

    raw = json.loads(pool_file.read_text(encoding="utf-8"))
    pools = raw.get("pools", {})
    cards: list[SetCatalogCard] = []
    for rarity in ("common", "uncommon", "rare", "holo"):
        for card_id in pools.get(rarity, []):
            cards.append(
                SetCatalogCard(
                    card_id=str(card_id),
                    rarity=rarity,
                    image_url=f"/cards/{set_id}/{card_id}.png",
                )
            )
    return SetCatalogResponse(set_id=set_id, cards=cards)


def _owned_card_ids_for_set(set_id: str) -> list[str]:
    state = _binder_service.get_binder_state()
    cards = state.get("cards", {})
    if not isinstance(cards, dict):
        return []
    owned: list[str] = []
    for rec in cards.values():
        if not isinstance(rec, dict):
            continue
        if rec.get("set_id") != set_id:
            continue
        qty = rec.get("quantity_owned")
        card_id = rec.get("card_id")
        if isinstance(card_id, str) and isinstance(qty, int) and qty > 0:
            owned.append(card_id)
    return owned


_SAFE_SEGMENT = re.compile(r"^[a-zA-Z0-9_-]+$")


def _resolve_card_image_path(set_id: str, card_id: str) -> Path:
    if not _SAFE_SEGMENT.fullmatch(set_id) or not _SAFE_SEGMENT.fullmatch(card_id):
        raise HTTPException(status_code=400, detail="Invalid set_id/card_id path segment")

    image_path = (DATASET_BASE_PATH / set_id / f"{card_id}.png").resolve()
    base_resolved = DATASET_BASE_PATH.resolve()
    if base_resolved not in image_path.parents:
        raise HTTPException(status_code=400, detail="Invalid image path")
    return image_path


def _resolve_card_json_path(set_id: str, card_id: str) -> Path:
    if not _SAFE_SEGMENT.fullmatch(set_id) or not _SAFE_SEGMENT.fullmatch(card_id):
        raise HTTPException(status_code=400, detail="Invalid set_id/card_id path segment")

    json_path = (DATASET_BASE_PATH / set_id / f"{card_id}.json").resolve()
    base_resolved = DATASET_BASE_PATH.resolve()
    if base_resolved not in json_path.parents:
        raise HTTPException(status_code=400, detail="Invalid metadata path")
    return json_path


def _parse_weaknesses(raw_weaknesses: Any) -> list[str]:
    if not isinstance(raw_weaknesses, list):
        return []
    out: list[str] = []
    for item in raw_weaknesses:
        if isinstance(item, str):
            # Serialized format example: "CardWeakRes(type='Fighting', value='×2')"
            match = re.search(r"type='([^']+)'", item)
            out.append(match.group(1) if match else item)
        elif isinstance(item, dict):
            value = item.get("type")
            if isinstance(value, str):
                out.append(value)
    return out


def _read_card_metadata(set_id: str, card_id: str) -> CardMetadataResponse:
    json_path = _resolve_card_json_path(set_id=set_id, card_id=card_id)
    if not json_path.exists():
        raise HTTPException(status_code=404, detail=f"Card metadata not found: {set_id}/{card_id}")

    raw = json.loads(json_path.read_text(encoding="utf-8"))
    dex_raw = raw.get("dexId")
    dex_id: int | None = None
    if isinstance(dex_raw, list) and dex_raw:
        first = dex_raw[0]
        if isinstance(first, int):
            dex_id = first
    elif isinstance(dex_raw, int):
        dex_id = dex_raw

    types = raw.get("types") if isinstance(raw.get("types"), list) else []
    normalized_types = [x for x in types if isinstance(x, str)]
    return CardMetadataResponse(
        set_id=set_id,
        card_id=card_id,
        name=raw.get("name") if isinstance(raw.get("name"), str) else None,
        category=raw.get("category") if isinstance(raw.get("category"), str) else None,
        dex_id=dex_id,
        description=raw.get("description") if isinstance(raw.get("description"), str) else None,
        types=normalized_types,
        weaknesses=_parse_weaknesses(raw.get("weaknesses")),
        rarity=raw.get("rarity") if isinstance(raw.get("rarity"), str) else None,
    )


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/openPack")
@app.post("/open-pack")
def open_pack_endpoint(payload: OpenPackRequest) -> dict[str, Any]:
    set_id = _extract_set_id(payload)
    try:
        result = open_pack(
            set_id=set_id,
            config=payload.config,
            seed=payload.seed,
            binder_state={"owned_card_ids": _owned_card_ids_for_set(set_id)},
            pools_dir=POOLS_DIR,
            metadata_dir=DATASET_BASE_PATH,
        )
        LOGGER.info(
            "open_pack_ok set=%s total_cards=%s",
            set_id,
            result.get("summary", {}).get("total_cards"),
        )
        return result
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except (TypeError, ValueError) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001
        LOGGER.exception("open pack failed")
        raise HTTPException(status_code=500, detail=f"openPack failed: {exc}") from exc


@app.post("/addCardsToBinder")
@app.post("/add-cards-to-binder")
def add_cards_to_binder_endpoint(payload: AddCardsRequest) -> dict[str, Any]:
    pack_result = _extract_pack_result(payload)
    try:
        with _binder_lock:
            return _binder_service.add_cards_to_binder(pack_result)
    except (TypeError, ValueError) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001
        LOGGER.exception("binder update failed")
        raise HTTPException(status_code=500, detail=f"addCardsToBinder failed: {exc}") from exc


@app.get("/getCollectionProgress")
@app.get("/collection-progress")
def get_collection_progress_endpoint(
    setId: str | None = Query(default=None), set_id: str | None = Query(default=None)
) -> dict[str, Any]:
    set_key = (setId or set_id or "").strip()
    if not set_key:
        raise HTTPException(status_code=400, detail="Missing setId/set_id query parameter")
    try:
        return _binder_service.get_collection_progress(set_key)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.get("/getGlobalProgress")
@app.get("/global-progress")
def get_global_progress_endpoint() -> dict[str, Any]:
    return _binder_service.get_global_progress()


@app.get("/getUnlockedSets")
@app.get("/unlocked-sets")
def get_unlocked_sets_endpoint() -> list[str]:
    return _binder_service.get_unlocked_sets()


@app.get("/getBinderState")
@app.get("/binder-state")
def get_binder_state_endpoint() -> dict[str, Any]:
    return _binder_service.get_binder_state()


@app.get("/getSetCatalog", response_model=SetCatalogResponse)
@app.get("/set-catalog", response_model=SetCatalogResponse)
def get_set_catalog_endpoint(
    setId: str | None = Query(default=None), set_id: str | None = Query(default=None)
) -> SetCatalogResponse:
    set_key = (setId or set_id or "").strip()
    if not set_key:
        raise HTTPException(status_code=400, detail="Missing setId/set_id query parameter")
    return _build_set_catalog(set_key)


@app.get("/cardMetadata", response_model=CardMetadataResponse)
@app.get("/card-metadata", response_model=CardMetadataResponse)
def get_card_metadata_endpoint(
    setId: str | None = Query(default=None),
    set_id: str | None = Query(default=None),
    cardId: str | None = Query(default=None),
    card_id: str | None = Query(default=None),
) -> CardMetadataResponse:
    set_key = (setId or set_id or "").strip()
    card_key = (cardId or card_id or "").strip()
    if not set_key or not card_key:
        raise HTTPException(status_code=400, detail="Missing setId/set_id or cardId/card_id query parameter")
    metadata = _read_card_metadata(set_id=set_key, card_id=card_key)
    LOGGER.info(
        "card_metadata_resolve set=%s card=%s has_description=%s has_types=%s has_weaknesses=%s",
        set_key,
        card_key,
        bool(metadata.description),
        bool(metadata.types),
        bool(metadata.weaknesses),
    )
    return metadata


@app.get("/cards/{set_id}/{card_id}.png")
def get_card_image(set_id: str, card_id: str) -> FileResponse:
    image_path = _resolve_card_image_path(set_id=set_id, card_id=card_id)
    exists = image_path.exists()
    LOGGER.info(
        "card_image_resolve set=%s card=%s path=%s exists=%s",
        set_id,
        card_id,
        image_path,
        exists,
    )
    if not exists:
        raise HTTPException(status_code=404, detail=f"Card image not found: {set_id}/{card_id}")
    return FileResponse(str(image_path), media_type="image/png")
