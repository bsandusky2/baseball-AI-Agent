# Baseball AI Agent

An AI baseball analyst backed by full-season Statcast pitch-by-pitch data. Ask
it things like "How has Shohei Ohtani performed against left-handed
pitching?" or "Why does Aaron Judge struggle against left-handed sliders?"
and it writes and runs SQL, computes correct sabermetric stats, and answers
in text and/or charts. A Next.js dashboard sits on top for browsing player
profiles and chatting with the agent.

## How it works

- **Data**: Statcast pitch-by-pitch data (2020–2025) loaded into a local
  [DuckDB](https://duckdb.org/) database, plus a derived `players` table
  (names, career years) and a pre-aggregated `hitter_pitch_stats` table.
- **Agent**: a [smolagents](https://github.com/huggingface/smolagents)
  `CodeAgent` (`app.py`) backed by an OpenAI model, given custom tools that
  query DuckDB directly rather than letting the model write raw SQL/formulas
  from scratch:
  - `run_sql_query` — arbitrary read-only SQL against the database
  - `player_stat_line` — correct batting/pitching lines (AVG/OBP/SLG,
    strikeouts, walks) for one player, with handedness and pitch-type filters
  - `matchup_leaderboard` — ranked matchup breakdowns by opponent, pitch
    type, or strike-zone location
  - `create_baseball_chart` / `render_chart` — turn query results into a
    pitch-location heatmap image or a structured chart payload the frontend
    can render (line, bar, scatter, heatmap grid, spray chart, pitch
    trajectory, stat tiles)
  - `prompt.yaml` encodes the agent's system prompt, sabermetric rules (at-bat
    definitions, handedness columns, when to chart vs. answer in prose), and
    worked examples.
- **Backend API**: a [FastAPI](https://fastapi.tiangolo.com/) app
  (`backend/fastAPI.py`) that exposes:
  - `GET /players` — searchable player list
  - `GET /kpi/{player_id}` — headline stats (xwOBA, whiff rate, chase rate,
    exit velocity, barrel rate, run value)
  - `GET /kpi/{player_id}/heatmap`, `/velocity`, `/spin-rate`,
    `/pitch-arsenal`, `/bat-tracking`, `/home-runs` — chart-specific endpoints
    for a player's dashboard
  - `POST /chat` — sends a message to the smolagents agent (one agent
    instance per `chat_id`) and returns text and/or chart payloads
- **Frontend**: a Next.js/TypeScript dashboard (`frontend/`) with player
  search, KPI tiles, and chart components (velocity, spin rate, pitch
  arsenal, swing profile, home runs, heatmaps) plus a chat panel wired to
  `POST /chat`.

## Project layout

```
app.py                  smolagents CodeAgent + tool definitions
prompt.yaml             agent system prompt / rules / examples
backend/fastAPI.py      FastAPI app: player + KPI REST endpoints, /chat
tools/                  final_answer tool (required by smolagents)
scripts/                one-off pipeline scripts that build data/baseball.duckdb:
                         download Statcast, load into DuckDB, clean/derive
                         columns, build the players and hitter_pitch_stats
                         tables
frontend/               Next.js dashboard (player pages, charts, chat UI)
data/                   local DuckDB database + raw files (gitignored, not
                         checked in — see Setup)
```

## Setup

### 1. Python environment

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Create a `.env` file in the project root with:

```
OPENAI_API_KEY=your-key-here
```

### 2. Build the database

`data/` is gitignored (Statcast data is too large for GitHub), so it has to
be built locally by running the scripts in `scripts/` in order:

```bash
python scripts/01_create_database.py        # creates data/baseball.duckdb
python scripts/02_download_statcast.py      # downloads Statcast via pybaseball
python scripts/04_load_statcast.py          # loads raw parquet into DuckDB
python scripts/07_create_clean_statcast.py  # rebuilds statcast with clean columns
python scripts/08_derived_features.py       # adds derived columns (e.g. velocity_band)
python scripts/09_create_hitter_pitch_stats.py  # pre-aggregated batter/pitch stats
python scripts/11b_download_players_raw.py  # downloads Chadwick player register
python scripts/12_build_players.py          # builds the players table
```

(`scripts/03_inspect_data.py`, `05_test_database.py`, and
`data_quality_check.py` are inspection/verification helpers, not part of the
required build order.)

### 3. Run the backend

```bash
uvicorn backend.fastAPI:app --reload
```

Runs on `http://localhost:8000` by default.

### 4. Run the frontend

```bash
cd frontend
pnpm install
```

Create `frontend/.env.local` with:

```
NEXT_PUBLIC_API_URL=http://localhost:8000
```

```bash
pnpm dev
```

Runs on `http://localhost:3000`.

### 5. (Optional) Gradio playground

`app.py` also builds a standalone agent that can be wrapped in a Gradio UI
for quick testing outside the full frontend/backend stack.

## Notes

- The DuckDB connection in both `app.py` and `backend/fastAPI.py` is opened
  once, read-only, and shared — the write path is exclusively the numbered
  scripts in `scripts/`.
- `player_stat_line` and `matchup_leaderboard` exist so the agent doesn't
  re-derive sabermetric formulas (at-bat definitions, total-base weighting,
  batter vs. pitcher handedness columns) from scratch in ad-hoc SQL, which is
  an easy place to get subtly wrong results.
