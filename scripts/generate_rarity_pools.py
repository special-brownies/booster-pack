#!/usr/bin/env python3
"""Generate deterministic rarity pools from local Pokemon TCG card metadata."""

from __future__ import annotations

import argparse
import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


PACK_TEMPLATE = {"rare_or_holo": 1, "uncommon": 3, "common": 5}


def _default_dataset_dir() -> Path:
    configured = os.getenv("DATASET_PATH")
    if configured and configured.strip():
        return Path(configured).expanduser().resolve()
    return (Path.cwd() / "pokemon_series").resolve()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Generate rarity pool files per set from local card JSON metadata."
    )
    parser.add_argument(
        "--input-dir",
        default=_default_dataset_dir(),
        type=Path,
        help="Directory containing one folder per set with card JSON files.",
    )
    parser.add_argument(
        "--output-dir",
        default="pools",
        type=Path,
        help="Directory to write consolidated pool files.",
    )
    parser.add_argument(
        "--verbose",
        action="store_true",
        help="Print anomaly details for each set.",
    )
    return parser.parse_args()


def classify_bucket(rarity_value: str | None, variant_details: Any) -> str | None:
    rarity_normalized = (rarity_value or "").strip().lower()

    holo_variant = False
    if isinstance(variant_details, dict):
        holo_variant = variant_details.get("holo") is True

    if holo_variant or ("holo" in rarity_normalized):
        return "holo"
    if "uncommon" in rarity_normalized:
        return "uncommon"
    if "common" in rarity_normalized:
        return "common"
    if "rare" in rarity_normalized:
        return "rare"
    return None


def build_set_pool(set_dir: Path, output_dir: Path, verbose: bool) -> dict[str, Any]:
    pools: dict[str, list[str]] = {"common": [], "uncommon": [], "rare": [], "holo": []}
    missing_rarity: list[str] = []
    unclassified_rarity: list[dict[str, str | None]] = []
    parse_errors: list[dict[str, str]] = []
    total_cards_scanned = 0

    json_files = sorted(
        [p for p in set_dir.iterdir() if p.is_file() and p.suffix.lower() == ".json"],
        key=lambda p: p.name,
    )

    for json_file in json_files:
        try:
            data = json.loads(json_file.read_text(encoding="utf-8"))
        except Exception as exc:  # noqa: BLE001
            parse_errors.append({"file": json_file.name, "error": str(exc)})
            continue

        total_cards_scanned += 1
        card_id = str(data.get("id") or json_file.stem)
        rarity_value = data.get("rarity")
        if rarity_value is None:
            missing_rarity.append(card_id)
        bucket = classify_bucket(rarity_value, data.get("variant_details"))

        if bucket is None:
            unclassified_rarity.append({"card_id": card_id, "rarity": rarity_value})
            continue

        pools[bucket].append(card_id)

    for key in pools:
        pools[key].sort()

    output_data: dict[str, Any] = {
        "set_id": set_dir.name,
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "source_dir": str(set_dir).replace("\\", "/"),
        "assumptions": {
            "holo_rule": "variant_details.holo == true, else rarity text contains 'holo'",
            "include_categories": "all",
            "duplicate_policy": "allowed_within_pack",
            "pack_template": PACK_TEMPLATE,
        },
        "counts": {
            "total_cards_scanned": total_cards_scanned,
            "common": len(pools["common"]),
            "uncommon": len(pools["uncommon"]),
            "rare": len(pools["rare"]),
            "holo": len(pools["holo"]),
            "unclassified": len(unclassified_rarity),
            "parse_errors": len(parse_errors),
        },
        "pools": pools,
        "anomalies": {
            "missing_rarity": missing_rarity,
            "unclassified_rarity": unclassified_rarity,
            "parse_errors": parse_errors,
        },
    }

    output_file = output_dir / f"{set_dir.name}.json"
    output_file.write_text(json.dumps(output_data, indent=2) + "\n", encoding="utf-8")

    anomalies_total = len(missing_rarity) + len(unclassified_rarity) + len(parse_errors)
    print(
        f"[{set_dir.name}] scanned={total_cards_scanned} "
        f"common={len(pools['common'])} uncommon={len(pools['uncommon'])} "
        f"rare={len(pools['rare'])} holo={len(pools['holo'])} "
        f"anomalies={anomalies_total} -> {output_file.as_posix()}"
    )
    if verbose:
        if missing_rarity:
            print(f"  missing_rarity: {missing_rarity}")
        if unclassified_rarity:
            print(f"  unclassified_rarity: {unclassified_rarity}")
        if parse_errors:
            print(f"  parse_errors: {parse_errors}")

    return {
        "set_id": set_dir.name,
        "output_file": output_file,
        "counts": output_data["counts"],
        "anomalies_total": anomalies_total,
    }


def main() -> int:
    args = parse_args()
    input_dir: Path = args.input_dir
    output_dir: Path = args.output_dir
    verbose: bool = args.verbose

    if not input_dir.exists() or not input_dir.is_dir():
        print(f"Input directory not found or not a directory: {input_dir}")
        return 1

    set_dirs = sorted([p for p in input_dir.iterdir() if p.is_dir()], key=lambda p: p.name)
    output_dir.mkdir(parents=True, exist_ok=True)

    if not set_dirs:
        print(f"No set folders found under: {input_dir}")
        return 1

    summaries: list[dict[str, Any]] = []
    for set_dir in set_dirs:
        summaries.append(build_set_pool(set_dir, output_dir, verbose))

    total_cards = sum(item["counts"]["total_cards_scanned"] for item in summaries)
    total_anomalies = sum(item["anomalies_total"] for item in summaries)

    print("\nFinal summary")
    print(f"  sets_processed: {len(summaries)}")
    print(f"  total_cards_scanned: {total_cards}")
    print(f"  total_anomalies: {total_anomalies}")
    print("  per_set_counts:")
    for item in summaries:
        counts = item["counts"]
        print(
            f"    {item['set_id']}: common={counts['common']} "
            f"uncommon={counts['uncommon']} rare={counts['rare']} "
            f"holo={counts['holo']} unclassified={counts['unclassified']} "
            f"parse_errors={counts['parse_errors']}"
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
