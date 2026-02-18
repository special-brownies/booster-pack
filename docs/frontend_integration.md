# Frontend Experience and Integration Layer

## Architecture Overview

Frontend lives in `frontend/` as a Next.js (App Router) app with:

- `frontend/app/*`: route-level UI (`/` for pack flow, `/binder` for collection browser)
- `frontend/components/*`: reusable UI components
- `frontend/lib/api/*`: typed API client + endpoint payload contracts
- `frontend/lib/state/*`: global app state (Context + reducer)
- `frontend/lib/hooks/*`: orchestration hooks for hydration, pack flow, binder sync
- `frontend/lib/services/*`: resolver services (local-first card detail resolution + API fallback)
- `frontend/app/api/*`: optional proxy route handlers to backend API base URL

## Component Tree

- `RootLayout` (`frontend/app/layout.tsx`)
  - `AppStateProvider`
    - `AppBootstrap` (rehydration + reduced-motion detection)
    - `TopNav`
    - `ErrorBanner`
    - route content
      - `HomePage` (`frontend/app/page.tsx`)
        - `DashboardSummary`
        - `PackSelectionBoard`
        - `PackRevealStage`
      - `BinderPage` (`frontend/app/binder/page.tsx`)
        - `BinderFilters`
        - `BinderGrid`
    - `LoadingOverlay`
    - `CelebrationToast`

## State Shape

Defined in `frontend/lib/state/app-state.tsx`.

- `selectedSet: string`
- `unlockedSets: string[]`
- `globalProgress: GlobalProgress | null`
- `setProgressMap: Record<string, CollectionProgress>`
- `lastOpenedPack: PackResult | null`
- `binderCache: Record<setId, { loadedAt, cards[] }>`
- `reducedMotion: boolean`
- `ui`:
  - `isHydrating`
  - `isOpeningPack`
  - `isUpdatingBinder`
  - `isRevealing`
  - `revealStep`
  - `animationState`
  - `errorMessage`
  - `celebration`

## API Integration Examples

All typed wrappers are in `frontend/lib/api/client.ts`.

### `openPack`

```ts
const pack = await apiClient.openPack({
  setId: "base2",
  config: { holo_upgrade_chance: 0.33, rare_slots: 1, uncommon_slots: 3, common_slots: 6 }
});
```

### `addCardsToBinder`

```ts
const summary = await apiClient.addCardsToBinder(pack);
```

### `getCollectionProgress`

```ts
const base2Progress = await apiClient.getCollectionProgress("base2");
```

### `getUnlockedSets`

```ts
const unlocked = await apiClient.getUnlockedSets();
```

### `getGlobalProgress`

```ts
const progress = await apiClient.getGlobalProgress();
```

### Binder/Browser helpers

```ts
const binderState = await apiClient.getBinderState();
const setCatalog = await apiClient.getSetCatalog("base2");
```

## User Flow Walkthrough

1. App boot:
- `AppBootstrap` calls hydration (`getUnlockedSets`, `getGlobalProgress`).
- UI initializes selected set and summary cards.

2. Pack opening:
- User picks an unlocked set in `PackSelectionBoard`.
- `openPackFlow` calls `openPack` with loading + retry handling.

3. Reveal:
- `PackRevealStage` reveals cards sequentially with rarity styles and new/duplicate badges.
- Reveal is controlled by a state machine (`idle -> flipping -> waiting -> completed`).
- Reveal mode supports both `manual` and `auto` progression.
- Clicking a revealed card opens a zoom modal (`left image / right details`).
- Reduced-motion preference is respected.

4. Binder sync:
- On final reveal card, frontend performs optimistic progress update.
- `addCardsToBinder` is called.
- On success, refreshes unlocked sets + global progress.
- On failure, optimistic state is rolled back with user-friendly error.

5. Unlock feedback:
- If backend returns `newly_unlocked_sets`, celebration toast appears.

## Extension Notes

For future systems:

- Currency: add `wallet` fields to global state and consume in `openPackFlow`.
- Achievements: render milestone cards from binder `events`.
- Trading: add a `tradeInventory` slice + API client methods.
- Offline mode: current app caches hydration snapshot in `localStorage`; can be expanded to full service-worker caching later.

## Runtime Configuration

`frontend/.env.example`:

- `BACKEND_API_BASE_URL`: backend API origin used by Next API proxy routes
- `NEXT_PUBLIC_API_BASE_URL`: optional direct client API base (keep empty to use proxy)
- `NEXT_PUBLIC_CARD_IMAGE_BASE_URL`: image base URL for card assets
- `NEXT_PUBLIC_AUTO_REVEAL_DELAY_MS`: auto reveal delay in milliseconds

Card image source:
- Frontend renders local dataset images through backend endpoint:
  - `GET /api/cards/{setId}/{cardId}.png`
- Backend resolves paths from:
  - `DATASET_PATH` when defined
  - otherwise `path.join(process.cwd(), "pokemon_series")`

Pokemon details resolver:
- `frontend/lib/services/pokemon-details-resolver.ts`
- Flow:
  1. load local metadata (`/card-metadata`)
  2. if local has `types + weaknesses + description`, use local
  3. else resolve lookup key (`dex_id` or `name`) and check memory cache
  4. fetch via `pokedex-promise-v2`
  5. normalize result and cache

If Next proxy routes are used, set `BACKEND_API_BASE_URL` (server-side env) for `frontend/app/api/*` handlers.
