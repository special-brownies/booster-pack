import asyncio
import json
import requests
from pathlib import Path
from tqdm import tqdm
from tcgdexsdk import TCGdex

OUTPUT_DIR = Path("pokemon_series")
OUTPUT_DIR.mkdir(exist_ok=True)

TARGET_SETS = [
    "base2",
    "jungle",
    "fossil",
    "base3",   # Team Rocket
    "base4",   # Gym Heroes
    "base5"
]

MAX_RETRIES = 3


def download_image_with_retry(url, path):
    for attempt in range(MAX_RETRIES):
        try:
            response = requests.get(url, timeout=20)
            response.raise_for_status()

            with open(path, "wb") as f:
                f.write(response.content)

            return True

        except Exception as e:
            print(f"Retry {attempt+1}/{MAX_RETRIES} failed:", e)

    return False


async def download_set(tcgdex, set_id):
    print(f"\n📦 Processing set: {set_id}")

    try:
        set_data = await tcgdex.set.get(set_id)
    except Exception as e:
        print(f"❌ Failed to fetch set {set_id}: {e}")
        return

    set_dir = OUTPUT_DIR / set_id
    set_dir.mkdir(exist_ok=True)

    progress = tqdm(set_data.cards, desc=set_id, unit="card")

    for card in progress:
        try:
            img_path = set_dir / f"{card.id}.png"
            json_path = img_path.with_suffix(".json")

            # 🔁 Auto-resume (skip if already downloaded)
            if img_path.exists() and json_path.exists():
                continue

            full_card = await tcgdex.card.get(card.id)

            image_url = full_card.get_image_url("high", "png")

            success = download_image_with_retry(image_url, img_path)

            if not success:
                print(f"⚠️ Failed to download {card.id}")
                continue

            variants = getattr(full_card, "variants", None)
            variant_info = variants.__dict__ if variants else {}

            metadata = full_card.__dict__.copy()
            metadata["variant_details"] = variant_info

            with open(json_path, "w", encoding="utf-8") as f:
                json.dump(metadata, f, default=str, indent=2)

        except Exception as e:
            print(f"⚠️ Error processing card {card.id}: {e}")


async def main():
    tcgdex = TCGdex("en")

    for set_id in TARGET_SETS:
        await download_set(tcgdex, set_id)

    print("\n✅ All sets processed!")


if __name__ == "__main__":
    asyncio.run(main())
