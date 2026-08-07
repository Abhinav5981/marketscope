# MarketScope — Portfolio Universe & Store Discovery

Upload a retail portfolio, define a market boundary on a map, discover stores inside it via a
real places API, and visualize everything on a dashboard.

## Tech stack

| Layer | Choice |
|---|---|
| Backend | Node.js + TypeScript + Express (manually layered — no framework magic) |
| Database | PostgreSQL + Prisma |
| Frontend | React + TypeScript + Vite, React Query for server state |
| Maps | Leaflet + react-leaflet + [leaflet-geoman-free](https://github.com/geoman-io/leaflet-geoman) for the draggable/resizable boundary rectangle |
| Store discovery | [OpenStreetMap Overpass API](https://overpass-api.de/) — free, no API key |
| Geocoding / city boundary | [OpenStreetMap Nominatim](https://nominatim.openstreetmap.org/) — free, no API key |
| Tests | Vitest (backend) |

Overpass and Nominatim are **free public instances**, not stubs — this app makes real HTTP calls
to them. That's also why they're not always fast or 100% reliable: both are shared, rate-limited
services, which is precisely the "real third-party API" behavior (rate limits, retries, partial
failures) this exercise asks about. No API keys or billing setup are required to run this project.

*Note on pagination:* the brief calls out pagination as part of real API handling, which mainly
applies to Google Places (New) — it returns up to 20 results per page with a `next_page_token`,
capped at 60 total. Overpass has no such paging model: a single query returns every matching
element in the boundary in one response (bounded instead by its `[timeout:N]` and the 30 sq km
area cap). We handle Overpass's actual failure modes instead — 429/504 retries, multi-endpoint
fallback, partial-result surfacing — see `overpassClient.ts` and its tests.

## Setup & run

**Prerequisites:** Node.js 20+, Docker (for Postgres). No API keys needed.

```bash
# 1. Start Postgres
docker compose up -d

# 2. Environment variables (defaults already match docker-compose.yml)
cp .env.example .env
cp .env.example backend/.env

# 3. Install dependencies (npm workspaces — installs backend + frontend in one go)
npm install

# 4. Apply the database schema and seed reference data
#    (countries/states/cities, store categories — see "Data model" below)
npm run db:migrate
npm run db:seed

# 5. Run both the backend (http://localhost:4000) and frontend (http://localhost:5173)
npm run dev
```

Then open **http://localhost:5173** and walk through: upload the sample portfolio
(`backend/sample-data/sample-portfolio.csv`) → define a market → watch it get created → explore
the dashboard.

If port `5432` is already in use on your machine, `docker-compose.yml` maps Postgres to host port
`5433` instead — adjust `DATABASE_URL` in `.env` if you change it further.

### Running tests

```bash
npm test
```

Runs the full backend Vitest suite (48 tests) from the repo root — no Postgres connection needed,
since nothing under test touches the database directly (see `backend/tests/setup.ts`). Covers:

- `lib/geo.ts` — point-in-boundary and area-calculation edge cases
- `lib/headerValidation.ts` — column/row validation rules
- `integrations/nominatim/*` — rate limiting, retry/backoff, User-Agent policy compliance
- `integrations/overpass/*` — query building, retry/fallback-endpoint behavior, partial failures
- `services/marketService.ts` — inside/outside/ungeocoded portfolio classification

### Sample data

`backend/sample-data/sample-portfolio.csv` is the sample PF file provided with the brief
(`sample_portfolio_bengaluru.csv`) — 10 real-looking Bengaluru stores across all 5 seeded
categories, with 3 rows missing lat/long (to exercise the geocoding path on market creation) and
7 with coordinates already provided. All 10 rows pass header/row validation as-is (verified via
`POST /api/portfolio/upload`).

To also exercise the validation *error* paths (a bad-type row, a missing-required-field row) and
the "portfolio outside boundary" layer (a row far outside every seeded city), append a few rows
like these before uploading — this isn't required, just useful for demoing the failure/edge-case
handling:

```csv
Bad Coordinate Store,Some Address,Bengaluru,Karnataka,India,Supermarket,not-a-number,77.6
,Some Address 2,Mumbai,Maharashtra,India,Pharmacy,,
Anna Salai Supermarket,Anna Salai,Chennai,Tamil Nadu,India,Supermarket,13.0604,80.2496
```

## Architecture decisions

- **No PostGIS** — a boundary is 4 floats; geo math is plain arithmetic in `lib/geo.ts`, which is all this scope needs.
- **No repository layer** — services call Prisma directly; it's already the SQL abstraction, and there's no second datastore to justify another layer.
- **`geo.ts` / `MAX_MARKET_AREA_SQ_KM` are duplicated** between backend and frontend (not a shared package) — ~30 lines total, not worth the setup ceremony at this scope.
- **Geocoded lat/long lives on `PortfolioStore` itself**, not a per-market snapshot — it's a property of the store, not the market. Inside/outside/ungeocoded is classified **on read** against each market's boundary, avoiding a staleness-prone snapshot table.
- **Portfolio re-upload replaces the portfolio** (not append) — there's no batch/versioning concept in scope, so appending would let duplicates accumulate.
- **Market creation is asynchronous** — `POST /markets` returns immediately with `status=PENDING`; the frontend polls `GET /markets/:id/status` every 2s. Geocoding + discovery can take up to ~a minute (Nominatim is capped at ~1 req/s), too long to hold a request open for.
- **Geocoding scope on market creation** — the brief asks to geocode rows "missing lat/long and falling within the boundary," but you can't know if an ungeocoded row is in the boundary before geocoding it. Resolved by geocoding ungeocoded rows whose uploaded `city` matches the market's city, rather than the whole portfolio on every run. Full reasoning in `marketCreationService.ts`.
- **Failures never abort the flow** — Nominatim retries with backoff, then leaves a row ungeocoded; Overpass retries then falls back to a mirror endpoint; a market only goes `FAILED` if discovery got zero usable results, not just a slow/partial one.
- **City boundary fallback** — if the live Nominatim lookup fails, Step 2 falls back to a small hardcoded box per seeded city, so a transient outage doesn't hard-fail the demo.

## Data model

```
Country ──< State ──< City ──< Market >── MarketCategory >── Category
                                  │
                                  └──< DiscoveredStore >── Category

PortfolioStore   (independent of Market — see "geocoding results live on PortfolioStore" above)
```

- `Country` / `State` / `City` — the fixed, seeded location list from the brief (India /
  Karnataka / Bengaluru, India / Maharashtra / Mumbai, India / Delhi / New Delhi). Dropdowns, not
  free text.
- `Category` — the seeded store categories, each mapped to one or more real OSM tags used by the
  Overpass query builder:

  | Category | OSM tag(s) |
  |---|---|
  | Supermarket | `shop=supermarket` |
  | Hypermarket | `shop=supermarket`, `shop=department_store` |
  | Grocery Store | `shop=greengrocer` |
  | Convenience Store | `shop=convenience` |
  | Pharmacy | `amenity=pharmacy` |

  (OSM has no clean tag distinguishing "hypermarket" from "supermarket" by scale — see Known
  limitations.)
- `Market` — a city + boundary (bounding box) + selected categories + `status`
  (`PENDING → DISCOVERING → READY`/`FAILED`) + `areaSqKm`.
- `DiscoveredStore` — one row per store found via Overpass inside a market's boundary, unique on
  `(marketId, externalId)` so re-running discovery is idempotent.
- `PortfolioStore` — the user's own uploaded stores, global (single-session, no market
  scoping) — see above for why.

## API summary

```
POST   /api/portfolio/upload            Upload + validate a CSV/XLSX, replaces the portfolio
GET    /api/portfolio                   List the current portfolio

GET    /api/locations/countries
GET    /api/locations/countries/:id/states
GET    /api/locations/states/:id/cities

GET    /api/categories

POST   /api/markets/preview-boundary    {cityId} -> initial boundary + area (via Nominatim)
POST   /api/markets                     {cityId, categoryIds[], boundary} -> creates market (async)
GET    /api/markets                     List markets
GET    /api/markets/:id/status          {status, errorMessage} — polled by the frontend
GET    /api/markets/:id                 Full dashboard payload (market, discovered stores,
                                         portfolio inside/outside/ungeocoded)
```

## Known limitations / shortcuts

- **No auth** — single user/session, as specified in scope.
- **Overpass/Nominatim are free public instances.** They can be slower or flakier than a paid API
  under load; the retry/backoff/fallback logic exists specifically to absorb that, but a
  particularly bad moment for the public instance can still mean a `READY` market with fewer
  discovered stores than actually exist (surfaced via `market.errorMessage` as a partial-results
  warning), or a portfolio row left in the "couldn't be located" bucket.
- **Area calculation is an approximation** (equirectangular, `cos(midLat)`-scaled), not
  geodesically exact — more than precise enough for a city-scale 30 sq km cap, documented in
  `lib/geo.ts`.
- **Portfolio `category` is free text**, not validated against the seeded `Category` list —
  portfolio categories are the customer's own taxonomy and don't need to match OSM's.
  Category-based filtering only applies to *discovered* stores.
- **No frontend automated tests** — time-boxed; the backend test suite covers the logic called
  out in the brief as the testing focus (boundary filtering, header validation, geo/API-client
  logic). Frontend behavior was verified manually end-to-end (including the drag-to-resize
  boundary interaction) via a driven headless-browser run rather than a committed test suite.
- **Bonus scope (150m store matching) was intentionally skipped** to keep the core flow clean and
  well-tested, per the brief's explicit preference.
- **`xlsx` (SheetJS) was avoided** — it has unpatched high-severity CVEs, and this app parses
  untrusted uploaded files. Used `exceljs` + `papaparse` instead. A few remaining low-risk
  `npm audit` findings (dev-server-only, and not applicable to this app's usage pattern) were
  reviewed and accepted rather than forced through a breaking downgrade.

## Project structure

```
/backend
  prisma/schema.prisma       Data model
  prisma/seed.ts             Seeds countries/states/cities + categories
  src/routes|controllers/    Thin HTTP layer
  src/services/              Business logic (portfolio, locations, categories, markets, orchestration)
  src/integrations/          Nominatim + Overpass clients (rate limiting, retry, fallback)
  src/lib/                   Pure, tested logic (geo.ts, headerValidation.ts, fileParser.ts)
  tests/                     Vitest suite, mirrors src/
  sample-data/                Sample portfolio CSV
/frontend
  src/pages/                  UploadPage, MarketSetupPage, MarketDashboardPage, MarketsListPage
  src/components/map/         BoundaryEditor (draggable/resizable rectangle), MarketMap, LayerToggle
  src/api/                    React Query hooks + fetch client
  src/lib/                    geo.ts + constants.ts (duplicated from backend, see above)
```
