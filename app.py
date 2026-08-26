from smolagents import CodeAgent,DuckDuckGoSearchTool, OpenAIServerModel,load_tool,tool
import datetime
import os
import requests
import pytz
import yaml
from dotenv import load_dotenv
from tools.final_answer import FinalAnswerTool
import duckdb
import pandas as pd
import numpy as np
import io
from PIL import Image
import matplotlib
matplotlib.use("Agg")  # headless — no GUI backend needed on a server
import matplotlib.pyplot as plt
from scipy.stats import gaussian_kde
from Gradio_UI import GradioUI

load_dotenv(override=True)

DB_PATH = "data/baseball.duckdb"
MAX_ROWS = 500

# Single shared read-only connection — DuckDB connections are meant to be
# opened once and reused for many queries, not re-opened per call. Read-only
# mode also means this never conflicts with the separate scripts that
# rebuild the database with their own read-write connections.
con = duckdb.connect(DB_PATH, read_only=True)

@tool
def run_sql_query(query: str) -> dict:
    """Run a read-only SQL query against the baseball DuckDB database.

    Only SELECT (or WITH ... SELECT) statements are allowed. Results are
    capped at 500 rows.

    Tables available: statcast (pitch-by-pitch Statcast data, including
    batter, pitcher, pitch_type, pitch_name, release_speed,
    release_spin_rate, plate_x, plate_z, balls, strikes, events,
    description, launch_speed, game_year, and more), players (player_id,
    first_name, last_name, mlb_first_year, mlb_last_year), and
    hitter_pitch_stats (pre-aggregated batter performance by pitch type
    and season).

    statcast has one row per PITCH, not per at-bat. `description` is the
    outcome of that single pitch (called_strike, swinging_strike, foul,
    ball, hit_into_play, etc.) — it is NOT the at-bat result. `events` is
    NULL on every pitch except the final pitch of a plate appearance,
    where it holds the actual at-bat outcome (strikeout, walk, single,
    double, home_run, field_out, etc.). An at-bat is identified by the
    combination of game_pk and at_bat_number.
    To answer "what happened in a hitter's last N at-bats", filter to
    events IS NOT NULL, order by game_date DESC (and at_bat_number DESC
    within a game), and limit N — don't just take the last N pitch rows.

    pitch_type is a case-sensitive code, not the English pitch name — e.g.
    filter with pitch_type = 'CU', never pitch_type = 'curveball'. Valid
    codes: FF 4-Seam Fastball, SI Sinker, FC Cutter, SL Slider, ST Sweeper,
    SV Slurve, CU Curveball, KC Knuckle Curve, CS Slow Curve, CH Changeup,
    FS Split-Finger, FO Forkball, SC Screwball, KN Knuckleball, EP Eephus,
    PO Pitch Out, FA/UN Other/Unknown. If a request names a pitch loosely
    (e.g. "curveball") and more than one code could match (CU, KC, CS all
    describe curveball variants), prefer the closest exact match (CU) but
    mention in your answer that related variants exist if it matters.
    Never conclude "no pitches found" from a pitch_type guess without
    first confirming the code — check this list or query
    SELECT DISTINCT pitch_type, pitch_name FROM statcast.

    If you're unsure of the exact columns on a table, first run:
    SELECT column_name, data_type FROM information_schema.columns
    WHERE table_name = '<table>'

    Args:
        query: A DuckDB SQL SELECT statement.
    """
    stripped = query.strip().lower()
    if not stripped.startswith("select") and not stripped.startswith("with"):
        return {"success": False, "error": "Only SELECT queries are allowed."}

    try:
        relation = con.sql(query)
        columns = relation.columns
        rows = relation.fetchmany(MAX_ROWS)
    except duckdb.Error as e:
        return {"success": False, "error": str(e)}

    return {
        "success": True,
        "columns": columns,
        "rows": [dict(zip(columns, row)) for row in rows],
        "truncated": len(rows) == MAX_ROWS,
    }

CHART_TYPES = ["pitch_heatmap"]

@tool
def create_baseball_chart(query: str, chart_type: str, label: str | None = None) -> Image.Image:
    """Run a SQL query and render the results as a baseball chart.

    Write the query to select exactly the columns the chosen chart_type
    needs (see below), then pass both to this tool. Pass the returned
    image directly to final_answer — do not describe it in text.

    If the user also asked for a specific stat (e.g. batting average,
    whiff rate) alongside the chart, do NOT try to cram that into this
    tool's query. Compute it first with a separate run_sql_query call,
    format it as text (e.g. "AVG: .258"), and pass it as `label` — it
    will be drawn directly on the chart.

    chart_type options and the columns their query must return:
    - pitch_heatmap: a smoothed density heat map of pitch locations over
      the strike zone, shaded blue (cold/rare) to red (hot/frequent),
      matching the style of MLB Statcast pitch-location charts. Query
      must return plate_x, plate_z (one row per pitch, no aggregation).

    Args:
        query: A DuckDB SQL SELECT statement returning the columns needed
            for the chosen chart_type.
        chart_type: One of "pitch_heatmap".
        label: Optional short text label (e.g. a computed stat) to
            display on the chart.
    """
    if chart_type not in CHART_TYPES:
        raise ValueError(f"chart_type must be one of {CHART_TYPES}, got '{chart_type}'.")

    stripped = query.strip().lower()
    if not stripped.startswith("select") and not stripped.startswith("with"):
        raise ValueError("Only SELECT queries are allowed.")

    df = con.sql(query).df()

    if chart_type == "pitch_heatmap":
        for col in ("plate_x", "plate_z"):
            if col not in df.columns:
                raise ValueError(f"chart_type 'pitch_heatmap' requires column '{col}' in the query result.")

        x = df["plate_x"].dropna().to_numpy()
        z = df["plate_z"].dropna().to_numpy()
        if len(x) < 5:
            raise ValueError("Not enough pitches with plate_x/plate_z to build a heat map (need at least 5).")

        xmin, xmax = -2.2, 2.2
        zmin, zmax = 0.5, 4.5

        kde = gaussian_kde(np.vstack([x, z]))
        xx, zz = np.mgrid[xmin:xmax:200j, zmin:zmax:200j]
        density = kde(np.vstack([xx.ravel(), zz.ravel()])).reshape(xx.shape)

        fig, ax = plt.subplots(figsize=(6, 6.5))
        mesh = ax.pcolormesh(xx, zz, density, cmap="coolwarm", shading="gouraud")

        sz_bot, sz_top = 1.5, 3.5
        plate_half_width = 0.83
        ax.add_patch(plt.Rectangle(
            (-plate_half_width, sz_bot),
            2 * plate_half_width,
            sz_top - sz_bot,
            fill=False, edgecolor="black", linewidth=2
        ))

        ax.set_xlim(xmin, xmax)
        ax.set_ylim(zmin, zmax)
        ax.set_aspect("equal")
        ax.set_xlabel("Horizontal Location (ft, catcher's view)")
        ax.set_ylabel("Height (ft)")
        ax.set_title("Pitch Location Density")
        fig.colorbar(mesh, ax=ax, label="Relative density")

    if label:
        ax.text(
            0.03, 0.97, label,
            transform=ax.transAxes,
            ha="left", va="top",
            fontsize=13, fontweight="bold", color="black",
            bbox=dict(boxstyle="round,pad=0.3", facecolor="white", edgecolor="black", alpha=0.85),
        )

    buf = io.BytesIO()
    fig.savefig(buf, format="png", dpi=120)
    plt.close(fig)
    buf.seek(0)
    return Image.open(buf)

final_answer = FinalAnswerTool()

model = OpenAIServerModel(
max_tokens=2096,
temperature=0.5,
model_id='gpt-4o-mini', # cheap, fast, solid tool-calling; bump to 'gpt-4o' for tougher tasks
api_key=os.environ["OPENAI_API_KEY"],
)


# Import tool from Hub
#image_generation_tool = load_tool("agents-course/text-to-image", trust_remote_code=True)

with open("prompt.yaml", 'r') as stream:
    prompt_templates = yaml.safe_load(stream)

agent = CodeAgent(
    model=model,
    tools=[final_answer, run_sql_query, create_baseball_chart], ## add your tools here (don't remove final answer)
    max_steps=6,
    verbosity_level=1,
    planning_interval=None,
    name=None,
    description=None,
    prompt_templates=prompt_templates
)


GradioUI(agent).launch()
