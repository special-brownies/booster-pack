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
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
NEXT_PUBLIC_AUTO_REVEAL_DELAY_MS=700
```

## Required Backend Endpoints

- `POST /api/open-pack`
- `POST /api/add-cards-to-binder`
- `POST /api/reset-progress`
- `GET /api/collection-progress?setId=...`
- `GET /api/global-progress`
- `GET /api/unlocked-sets`
- `GET /api/binder-state`
- `GET /api/set-catalog?setId=...`
- `GET /api/card-metadata?setId=...&cardId=...`
- `GET /api/cards/:setId/:cardId.png`

The app calls these via `frontend/lib/api/client.ts`.
Set `NEXT_PUBLIC_API_BASE_URL` to the backend origin (for example `https://your-backend.up.railway.app`).
