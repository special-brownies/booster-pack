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

from fastapi import FastAPI, HTTPException, Query, APIRouter
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

# 🌐 CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 🔹 API router with prefix
api = APIRouter(prefix="/api")

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


def _owned_card_ids_for_set(set_id: str) -> list[str]:
    state = _binder_service.get_binder_state()
    cards = state.get("cards", {})
    if not isinstance(cards, dict):
        return []
    return [
        rec["card_id"]
        for rec in cards.values()
        if isinstance(rec, dict)
        and rec.get("set_id") == set_id
        and isinstance(rec.get("quantity_owned"), int)
        and rec.get("quantity_owned") > 0
    ]


_SAFE_SEGMENT = re.compile(r"^[a-zA-Z0-9_-]+$")


def _resolve_card_image_path(set_id: str, card_id: str) -> Path:
    if not _SAFE_SEGMENT.fullmatch(set_id) or not _SAFE_SEGMENT.fullmatch(card_id):
        raise HTTPException(status_code=400, detail="Invalid path")

    image_path = (DATASET_BASE_PATH / set_id / f"{card_id}.png").resolve()
    if DATASET_BASE_PATH.resolve() not in image_path.parents:
        raise HTTPException(status_code=400, detail="Invalid image path")
    return image_path


def _resolve_card_json_path(set_id: str, card_id: str) -> Path:
    if not _SAFE_SEGMENT.fullmatch(set_id) or not _SAFE_SEGMENT.fullmatch(card_id):
        raise HTTPException(status_code=400, detail="Invalid path")

    json_path = (DATASET_BASE_PATH / set_id / f"{card_id}.json").resolve()
    if DATASET_BASE_PATH.resolve() not in json_path.parents:
        raise HTTPException(status_code=400, detail="Invalid metadata path")
    return json_path


def _parse_weaknesses(raw_weaknesses: Any) -> list[str]:
    if not isinstance(raw_weaknesses, list):
        return []
    out: list[str] = []
    for item in raw_weaknesses:
        if isinstance(item, str):
            match = re.search(r"type='([^']+)'", item)
            out.append(match.group(1) if match else item)
        elif isinstance(item, dict) and isinstance(item.get("type"), str):
            out.append(item["type"])
    return out


# ✅ FIXED FUNCTION (null-safe)
def _read_card_metadata(set_id: str, card_id: str) -> CardMetadataResponse:
    json_path = _resolve_card_json_path(set_id=set_id, card_id=card_id)
    if not json_path.exists():
        raise HTTPException(status_code=404, detail="Card metadata not found")

    raw = json.loads(json_path.read_text(encoding="utf-8"))

    dex_raw = raw.get("dexId")
    dex_id: int | None = None
    if isinstance(dex_raw, list) and dex_raw:
        if isinstance(dex_raw[0], int):
            dex_id = dex_raw[0]
    elif isinstance(dex_raw, int):
        dex_id = dex_raw

    raw_types = raw.get("types")
    safe_types = raw_types if isinstance(raw_types, list) else []

    raw_weaknesses = raw.get("weaknesses")
    safe_weaknesses = _parse_weaknesses(raw_weaknesses) if raw_weaknesses else []

    return CardMetadataResponse(
        set_id=set_id,
        card_id=card_id,
        name=raw.get("name") if isinstance(raw.get("name"), str) else None,
        category=raw.get("category") if isinstance(raw.get("category"), str) else None,
        dex_id=dex_id,
        description=raw.get("description") if isinstance(raw.get("description"), str) else None,
        types=[x for x in safe_types if isinstance(x, str)],
        weaknesses=safe_weaknesses,
        rarity=raw.get("rarity") if isinstance(raw.get("rarity"), str) else None,
    )


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@api.post("/open-pack")
def open_pack_endpoint(payload: OpenPackRequest):
    set_id = _extract_set_id(payload)
    return open_pack(
        set_id=set_id,
        config=payload.config,
        seed=payload.seed,
        binder_state={"owned_card_ids": _owned_card_ids_for_set(set_id)},
        pools_dir=POOLS_DIR,
        metadata_dir=DATASET_BASE_PATH,
    )


@api.post("/add-cards-to-binder")
def add_cards_to_binder_endpoint(payload: AddCardsRequest):
    pack_result = _extract_pack_result(payload)
    with _binder_lock:
        return _binder_service.add_cards_to_binder(pack_result)


@api.get("/global-progress")
def get_global_progress_endpoint():
    return _binder_service.get_global_progress()


@api.get("/unlocked-sets")
def get_unlocked_sets_endpoint():
    return _binder_service.get_unlocked_sets()


@api.get("/binder-state")
def get_binder_state_endpoint():
    return _binder_service.get_binder_state()


@api.get("/card-metadata", response_model=CardMetadataResponse)
def get_card_metadata_endpoint(setId: str, cardId: str):
    return _read_card_metadata(setId, cardId)


@api.get("/cards/{set_id}/{card_id}.png")
def get_card_image(set_id: str, card_id: str):
    image_path = _resolve_card_image_path(set_id, card_id)
    if not image_path.exists():
        raise HTTPException(status_code=404, detail="Image not found")
    return FileResponse(str(image_path), media_type="image/png")


app.include_router(api)
