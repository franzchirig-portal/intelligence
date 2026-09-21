# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Citrino "Intelligence": real-estate market intelligence for Bolivia (Santa Cruz `SCZ`, La Paz `LPZ`, Cochabamba `CBB`). Two independent halves connected only through Supabase:

1. **`pipeline/`** — Python ETL: Google Sheets → transform → Supabase (Postgres).
2. **`frontend/`** — React 19 + TypeScript + Vite dashboard ("Workspace OS") that reads Supabase directly from the browser.

UI copy, docs and commit messages are in Spanish (commits use conventional-commit prefixes such as `feat(gis):`, `fix(build):`, `style:`).

Note: `README.md` and `.agents/skills/sheets_supabase_pipeline/SKILL.md` still describe the old Medallion (Bronze/Silver/Gold) design and files like `003_gold_views.sql`. The current code uses the **"Diamond" model** (see below); trust the code and `supabase/00*.sql` over the README.

## Commands

Pipeline (run from repo root; needs `.env` — see `.env.example` — with `GOOGLE_APPLICATION_CREDENTIALS`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`):

```bash
pip install -r requirements.txt
python -m pipeline.sync
```

Frontend (run from `frontend/`; needs `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `frontend/.env*`):

```bash
npm install
npm run dev       # vite dev server
npm run build     # vite build (no tsc step; type errors do not fail the build)
npm run lint      # oxlint
```

There is no test suite for either half.

## Pipeline architecture

`pipeline/sync.py` orchestrates: for each city in `config.SHEETS_CONFIG` fetch 3 tabs (`datos_margenes`, `tipologia_precios`, `amenidades`) via `SheetsClient` → `DiamondTransformer.transform_all(scz, lpz, cbb)` in `transform.py` → `SupabaseLoader.upsert_batch` in FK-safe order: `proyectos`, `indicadores_censo`, `tipologias`, `avg_tipologias`, `condiciones_financieras`, `amenidades`. Table names come from `config.DIAMOND_TABLES` (Supabase tables are prefixed `oferta_*`). Any extraction or load failure calls `sys.exit(1)` deliberately, to avoid partial/false-positive syncs.

- `utils.py` parses Bolivian number formats; `config.py` maps sheet headers (with many spelling variants) to internal columns — add new header variants there.
- `geospatial.py` (`KMZMatcher`) loads polygons from `datakmz/*.kmz` and does point-in-polygon matching to assign zones to projects by lat/lon.
- `.github/workflows/sync-pipeline.yml` runs the sync every 6h, on manual dispatch and on pushes touching `pipeline/**`, `supabase/**` or `requirements.txt`. Secrets: `GOOGLE_CREDENTIALS`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`. Note: `sync.py` currently ignores the `SYNC_CITY/TAB/MODE` env vars the workflow passes.
- `supabase/001–003_*.sql` are applied manually (schema, public-read RLS, auth config).

## Frontend architecture

- `src/lib/supabase.ts` is the whole data layer: Supabase client, types (`Proyecto`, `IndicadorCenso`, `AvgTipologia`, `IndicadorFull`), and fetchers with a 60s in-memory cache. It fetches `oferta_proyectos` and `oferta_indicadores_censo` whole and **joins in JS** (`fetchIndicadores`); `getLatestPerProject` picks the newest snapshot per project. Metric helpers (`computeZonaMetrics`, `computeTipologiaBenchmarks`, `fetchKPIs`) live here too.
- `src/App.tsx` owns session/auth state (Supabase auth or guest mode via `AuthScreen`), the city filter (`SCZ|LPZ|CBB|ALL`), the top tab bar, and the Antigravity-IDE-style shell (`LeftSidebar`, `RightSidebar`/`ChatPanel`, `CommandPalette` on Ctrl/⌘+K).
- Each tab is a large panel component in `src/components/`: `WorkspaceOSPanel` (Mission Control, comparator, report generator — see `docs/WORKSPACE_OS_GUIDE.md`), `AnalysisPanel`, `TipologiasPanel`, `WorkspacePanel`, `GeoespacialPanel` (maps, heatmaps, bubble maps, QGIS layers). Charts use ECharts (`echarts-for-react`).
- Styling is plain CSS in `src/index.css` / `App.css` following an Antigravity IDE dark palette; there is no CSS framework.

## Deployment

Frontend deploys via Vercel (`vercel.json`: builds in `frontend/`, output `frontend/dist`) or Netlify (`netlify.toml`), both with SPA rewrite to `index.html`.
