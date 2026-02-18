# Frontend

## Run

Backend API:

1. `cd ..` (repo root)
2. `python -m pip install -r requirements-api.txt`
3. (optional) set dataset location:
   - PowerShell: `$env:DATASET_PATH = (Join-Path (Get-Location) "pokemon_series")`
   - bash/zsh: `export DATASET_PATH="$(pwd)/pokemon_series"`
4. `python -m uvicorn api_server:app --host 0.0.0.0 --port 8000 --reload`

Frontend:

1. `cd frontend`
2. `npm install`
3. copy `.env.example` to `.env.local`
4. `npm run dev`

Recommended `.env.local`:

```env
BACKEND_API_BASE_URL=http://localhost:8000
NEXT_PUBLIC_CARD_IMAGE_BASE_URL=http://localhost:8000/api/cards
NEXT_PUBLIC_AUTO_REVEAL_DELAY_MS=700
```

## Required Backend Endpoints

- `POST /open-pack`
- `POST /add-cards-to-binder`
- `GET /collection-progress?setId=...`
- `GET /global-progress`
- `GET /unlocked-sets`
- `GET /binder-state`
- `GET /set-catalog?setId=...`
- `GET /card-metadata?setId=...&cardId=...`
- `GET /api/cards/:setId/:cardId.png`

The app calls these via `frontend/lib/api/client.ts`.
