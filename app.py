from pathlib import Path

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

load_dotenv(override=True)

BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR / "data" / "baseball.duckdb"
MAX_ROWS = 500

# Single shared read-only connection — DuckDB connections are meant to be
# opened once and reused for many queries, not re-opened per call. Read-only
# mode also means this never conflicts with the separate scripts that
# rebuild the database with their own read-write connections.
con = duckdb.connect(str(DB_PATH), read_only=True)

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

    stand and p_throws are two DIFFERENT columns for two DIFFERENT people
    on the pitch — never use one where the other is meant:
    - stand: the BATTER's handedness (L/R) on that pitch.
    - p_throws: the PITCHER's handedness (L/R) on that pitch.
    A pitcher's own p_throws is fixed for their whole career (e.g. Shohei
    Ohtani, player_id 660271, is p_throws = 'R' on every pitch he throws —
    filtering pitcher = 660271 AND p_throws = 'L' is self-contradictory
    and will always return zero rows, which is NOT the same as "he has
    never faced a left-handed hitter").

    A player_id can appear as EITHER batter or pitcher — two-way players
    like Ohtani appear as both. Pick the id column AND the handedness
    column together, based on what side of the matchup the question is
    actually about, not on which role is more common for that player:
    - "How did X do against left-handed pitching / vs. LHP" (X's hitting)
      -> filter batter = <player_id> AND p_throws = 'L' (the opposing
      pitcher's hand — never stand here, that's X's own hand).
    - "How did X do against left-handed hitters / vs. LHB" (X's pitching)
      -> filter pitcher = <player_id> AND stand = 'L' (the opposing
      batter's hand — never p_throws here, X's own throwing hand is
      irrelevant to this filter and is not what "left-handed" refers to
      in this phrasing).
    Read the phrasing carefully before picking — getting this backwards
    silently answers a completely different question, and getting the
    handedness column backwards silently returns zero rows that look like
    a valid (but wrong) "no data" answer.

    Sabermetric formulas — use these exactly, don't re-derive your own:
    - at-bat: a PA-ending pitch (events IS NOT NULL) where events IN
      ('single','double','triple','home_run','field_out','double_play',
      'field_error','fielders_choice','fielders_choice_out','force_out',
      'grounded_into_double_play','strikeout','strikeout_double_play',
      'triple_play'). Walks, HBP, sac bunts, sac flies, and catcher's
      interference are NOT at-bats — do NOT count events IS NOT NULL as
      "at-bats", that overcounts by including all of those.
    - hit: events IN ('single','double','triple','home_run')
    - strikeout: events IN ('strikeout','strikeout_double_play')
    - walk: events IN ('walk','intent_walk')
    - batting average = hits / at_bats
    - slugging % = total_bases / at_bats, where total_bases is
      1/2/3/4 for single/double/triple/home_run, 0 otherwise
    - on-base % = (hits + walks + hit_by_pitch) /
      (at_bats + walks + hit_by_pitch + sac_flies), where hit_by_pitch is
      events = 'hit_by_pitch' and sac_flies is
      events IN ('sac_fly','sac_fly_double_play')

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

@tool
def player_stat_line(
    player_id: int,
    role: str,
    opponent_hand: str | None = None,
    pitch_type: str | None = None,
    season: int | None = None,
) -> dict:
    """Compute a correct batting or pitching stat line for one player.

    Use this instead of writing your own SQL for batting average, OBP,
    slugging, strikeouts, or walks. Those formulas have specific rules
    (what counts as an at-bat, how total bases are weighted, which column
    is the batter's hand vs. the pitcher's hand) that are easy to get
    subtly wrong — this tool gets them right every time, so use it
    whenever a question calls for any of these stats rather than
    re-deriving the formulas yourself in run_sql_query.

    This tool returns the raw computed numbers as a dict — it does NOT
    produce chart-ready or display-ready output. Read the values and
    phrase them as a natural-language sentence for final_answer (see rule
    12); do not pass this dict directly to final_answer, and do not pass
    it to render_chart either (a stat line is not a series).

    Args:
        player_id: The MLBAM player_id.
        role: "batter" for the player's own hitting stats, or "pitcher"
            for what opposing batters did against the player's pitching.
            A two-way player (e.g. Shohei Ohtani) can be queried as
            either — pick based on what the question is actually asking
            about, not which role is more common for that player.
        opponent_hand: Optional 'L' or 'R' to filter by the OPPOSING
            player's handedness — the pitcher's throwing hand if
            role="batter", or the batter's stance if role="pitcher".
            Leave as None for no handedness filter.
        pitch_type: Optional pitch type code (e.g. 'SL', 'FF', 'CU') to
            restrict to one pitch type.
        season: Optional year (e.g. 2025) to restrict to one season.

    Returns:
        A dict with plate_appearances, at_bats, hits, batting_average,
        on_base_percentage, slugging_percentage, strikeouts, walks,
        hit_by_pitch. Rate stats are None if at_bats is 0.
    """
    if role not in ("batter", "pitcher"):
        raise ValueError("role must be 'batter' or 'pitcher'")
    if opponent_hand is not None and opponent_hand not in ("L", "R"):
        raise ValueError("opponent_hand must be 'L', 'R', or None")

    id_column = role
    hand_column = "p_throws" if role == "batter" else "stand"

    conditions = [f"{id_column} = ?"]
    params = [player_id]

    if opponent_hand:
        conditions.append(f"{hand_column} = ?")
        params.append(opponent_hand)
    if pitch_type:
        conditions.append("pitch_type = ?")
        params.append(pitch_type)
    if season:
        conditions.append("game_year = ?")
        params.append(season)

    where_clause = " AND ".join(conditions)

    row = con.execute(
        f"""
        SELECT
            COUNT(*) FILTER (WHERE events IN (
                'single','double','triple','home_run','field_out','double_play',
                'field_error','fielders_choice','fielders_choice_out','force_out',
                'grounded_into_double_play','strikeout','strikeout_double_play','triple_play'
            )) AS at_bats,
            COUNT(*) FILTER (WHERE events IN ('single','double','triple','home_run')) AS hits,
            COALESCE(SUM(CASE events
                WHEN 'single' THEN 1 WHEN 'double' THEN 2
                WHEN 'triple' THEN 3 WHEN 'home_run' THEN 4
                ELSE 0 END), 0) AS total_bases,
            COUNT(*) FILTER (WHERE events IN ('strikeout','strikeout_double_play')) AS strikeouts,
            COUNT(*) FILTER (WHERE events IN ('walk','intent_walk')) AS walks,
            COUNT(*) FILTER (WHERE events = 'hit_by_pitch') AS hit_by_pitch,
            COUNT(*) FILTER (WHERE events IN ('sac_fly','sac_fly_double_play')) AS sac_flies,
            COUNT(*) FILTER (WHERE events IS NOT NULL) AS plate_appearances
        FROM statcast
        WHERE {where_clause}
        """,
        params,
    ).fetchone()

    at_bats, hits, total_bases, strikeouts, walks, hbp, sac_flies, pa = row
    obp_denom = at_bats + walks + hbp + sac_flies

    return {
        "player_id": player_id,
        "role": role,
        "plate_appearances": pa,
        "at_bats": at_bats,
        "hits": hits,
        "batting_average": round(hits / at_bats, 3) if at_bats else None,
        "on_base_percentage": round((hits + walks + hbp) / obp_denom, 3) if obp_denom else None,
        "slugging_percentage": round(total_bases / at_bats, 3) if at_bats else None,
        "strikeouts": strikeouts,
        "walks": walks,
        "hit_by_pitch": hbp,
    }


AT_BAT_EVENTS_SQL = (
    "'single','double','triple','home_run','field_out','double_play',"
    "'field_error','fielders_choice','fielders_choice_out','force_out',"
    "'grounded_into_double_play','strikeout','strikeout_double_play','triple_play'"
)
HIT_EVENTS_SQL = "'single','double','triple','home_run'"


@tool
def matchup_leaderboard(
    player_id: int,
    role: str,
    group_by: str,
    opponent_hand: str | None = None,
    pitch_type: str | None = None,
    season: int | None = None,
    min_at_bats: int = 5,
    limit: int = 10,
) -> dict:
    """Find which opponents, pitch types, or zone locations a player has
    had the most success against/with, correctly grouped and ranked.

    Use this instead of writing your own GROUP BY query for "who hits X
    best", "what pitch does X succeed with", or "what location is X most
    successful at" — those are easy to get wrong in ways that look
    plausible but aren't:
    - AVG(CASE WHEN <hit> THEN 1 ELSE 0 END) over a GROUP BY averages
      over every PITCH in the group (balls, called strikes, etc.), not
      just at-bat-ending ones — it silently divides by the wrong (much
      larger) denominator. This tool divides hits by the correct at-bat
      count explicitly.
    - Grouping by exact plate_x/plate_z coordinates produces meaningless
      1-pitch "100%" groups. This tool buckets location into the same
      3x3 strike-zone grid used elsewhere in this app (row 0=high/row
      2=low, col 0=away/col 2=in, relative to the batter's stand) and
      excludes groups under min_at_bats so small samples don't dominate.
    When group_by="opponent", each row includes the opponent's actual
    name (joined from the players table) — never show a bare player_id
    to the user when a name is available; use these names in your answer
    instead.

    Ranking direction is chosen automatically based on what "success"
    means for the given grouping — you don't need to sort the results
    yourself:
    - group_by="opponent": ranked by the OPPONENT's own batting average
      descending — the opponent's success in that matchup, regardless of
      player_id's role.
    - group_by="pitch_type" or "location": ranked by PLAYER_ID's own
      success — if role="pitcher", ascending (lowest average allowed is
      most successful for a pitcher); if role="batter", descending
      (highest average is most successful for a hitter).

    Args:
        player_id: The MLBAM player_id whose matchups you're analyzing.
        role: "batter" (player_id's own hitting) or "pitcher" (player_id's
            own pitching, i.e. what opposing batters did against them).
        group_by: One of "opponent", "pitch_type", or "location".
        opponent_hand: Optional 'L'/'R' to filter by the opposing
            player's handedness.
        pitch_type: Optional pitch type code to restrict to one pitch
            (ignored if group_by="pitch_type", since that IS the grouping).
        season: Optional year to restrict to one season.
        min_at_bats: Minimum at-bats a group must have to be included, to
            keep small-sample noise (e.g. 1-for-1) out of the results.
            Defaults to 5.
        limit: Max rows to return after ranking. Defaults to 10.

    Returns:
        A dict with "rows": a list of {group_label, at_bats, hits,
        batting_average}, already sorted and limited as described above.
    """
    if role not in ("batter", "pitcher"):
        raise ValueError("role must be 'batter' or 'pitcher'")
    if group_by not in ("opponent", "pitch_type", "location"):
        raise ValueError("group_by must be 'opponent', 'pitch_type', or 'location'")
    if opponent_hand is not None and opponent_hand not in ("L", "R"):
        raise ValueError("opponent_hand must be 'L', 'R', or None")

    id_column = role
    opponent_column = "pitcher" if role == "batter" else "batter"
    hand_column = "p_throws" if role == "batter" else "stand"

    conditions = [f"{id_column} = ?"]
    params: list = [player_id]
    if opponent_hand:
        conditions.append(f"{hand_column} = ?")
        params.append(opponent_hand)
    if pitch_type and group_by != "pitch_type":
        conditions.append("pitch_type = ?")
        params.append(pitch_type)
    if season:
        conditions.append("game_year = ?")
        params.append(season)
    where_clause = " AND ".join(conditions)

    if group_by == "opponent":
        query = f"""
            WITH grouped AS (
                SELECT
                    {opponent_column} AS opponent_id,
                    COUNT(*) FILTER (WHERE events IN ({AT_BAT_EVENTS_SQL})) AS at_bats,
                    COUNT(*) FILTER (WHERE events IN ({HIT_EVENTS_SQL})) AS hits
                FROM statcast
                WHERE {where_clause}
                GROUP BY {opponent_column}
            )
            SELECT g.opponent_id, p.first_name, p.last_name, g.at_bats, g.hits
            FROM grouped g
            LEFT JOIN players p ON p.player_id = g.opponent_id
            WHERE g.at_bats >= ?
        """
    elif group_by == "pitch_type":
        query = f"""
            SELECT
                pitch_type,
                COUNT(*) FILTER (WHERE events IN ({AT_BAT_EVENTS_SQL})) AS at_bats,
                COUNT(*) FILTER (WHERE events IN ({HIT_EVENTS_SQL})) AS hits
            FROM statcast
            WHERE {where_clause}
            GROUP BY pitch_type
            HAVING COUNT(*) FILTER (WHERE events IN ({AT_BAT_EVENTS_SQL})) >= ?
        """
    else:
        query = f"""
            WITH pitches AS (
                SELECT
                    *,
                    CASE WHEN stand = 'R' THEN plate_x ELSE -plate_x END AS signed_x,
                    (plate_z - sz_bot) / NULLIF(sz_top - sz_bot, 0) AS zone_fraction
                FROM statcast
                WHERE {where_clause}
                  AND plate_x IS NOT NULL AND plate_z IS NOT NULL
                  AND sz_top IS NOT NULL AND sz_bot IS NOT NULL
            ),
            binned AS (
                SELECT
                    *,
                    CASE WHEN zone_fraction > 0.667 THEN 0 WHEN zone_fraction < 0.333 THEN 2 ELSE 1 END AS row,
                    CASE WHEN signed_x > 0.28 THEN 0 WHEN signed_x < -0.28 THEN 2 ELSE 1 END AS col
                FROM pitches
            )
            SELECT
                row, col,
                COUNT(*) FILTER (WHERE events IN ({AT_BAT_EVENTS_SQL})) AS at_bats,
                COUNT(*) FILTER (WHERE events IN ({HIT_EVENTS_SQL})) AS hits
            FROM binned
            GROUP BY row, col
            HAVING COUNT(*) FILTER (WHERE events IN ({AT_BAT_EVENTS_SQL})) >= ?
        """
    params.append(min_at_bats)

    rows = con.execute(query, params).fetchall()

    results = []
    if group_by == "opponent":
        for opponent_id, first_name, last_name, at_bats, hits in rows:
            name = f"{first_name} {last_name}" if first_name else f"Player {opponent_id}"
            results.append({
                "group_label": name,
                "opponent_id": opponent_id,
                "at_bats": at_bats,
                "hits": hits,
                "batting_average": round(hits / at_bats, 3) if at_bats else None,
            })
        reverse = True  # opponent's own success is always "higher average = more successful"
    elif group_by == "pitch_type":
        for pt, at_bats, hits in rows:
            results.append({
                "group_label": pt or "Unknown",
                "at_bats": at_bats,
                "hits": hits,
                "batting_average": round(hits / at_bats, 3) if at_bats else None,
            })
        reverse = role == "batter"
    else:
        row_labels = {0: "High", 1: "Middle", 2: "Low"}
        col_labels = {0: "Away", 1: "Middle", 2: "In"}
        for r, c, at_bats, hits in rows:
            results.append({
                "group_label": f"{row_labels[r]}-{col_labels[c]}",
                "row": r,
                "col": c,
                "at_bats": at_bats,
                "hits": hits,
                "batting_average": round(hits / at_bats, 3) if at_bats else None,
            })
        reverse = role == "batter"

    results.sort(key=lambda r: r["batting_average"], reverse=reverse)

    return {"role": role, "group_by": group_by, "min_at_bats": min_at_bats, "rows": results[:limit]}


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

CHART_DATA_SHAPES = {
    "line": ["x_label", "y_label", "points"],
    "bar": ["x_label", "y_label", "bars"],
    "scatter": ["x_label", "y_label", "points"],
    "heatmap_grid": ["legend_label", "cells"],
    "spray_chart": ["points"],
    "trajectory": ["pitches"],
    "stat_row": ["stats"],
}


@tool
def render_chart(chart_type: str, data: dict, title: str | None = None) -> dict:
    """Package query results into a chart the frontend will render.

    Get the numbers first (run_sql_query, player_stat_line, or
    matchup_leaderboard), then shape them into ONE of these seven
    chart_type values and pass the matching data structure.

    For a single chart, pass this tool's return value straight to
    final_answer — do not also describe the data in text, the chart
    replaces that. For a full breakdown across SEVERAL angles (e.g. "why
    does X struggle against Y" calls for a stat summary AND a location
    breakdown AND a velocity trend, not just one), call this tool once
    per relevant angle, collect the results into a list, and pass
    final_answer({"text": <one summary sentence>, "charts": [chart1,
    chart2, ...]}) instead — see the worked example below. Only include
    the angles that are actually relevant to the question; don't force
    all seven types onto a question that only needs one or two.

    Pick chart_type by what the QUESTION is actually asking for, not by
    what table the numbers came from:

    - "line": a value that changes over an ordered axis, usually time
      (e.g. velocity across a season, rolling wOBA over recent games).
      data = {"x_label": str, "y_label": str,
              "points": [{"x": <date or ordered category>, "y": <number>}, ...]}

    - "bar": comparing a value across a small number of discrete
      categories (e.g. whiff rate by pitch type, exit velo by count).
      data = {"x_label": str, "y_label": str,
              "bars": [{"label": <category name>, "value": <number>}, ...]}

    - "scatter": the relationship between two numeric measures across
      many individual points (e.g. spin rate vs. whiff rate per pitch).
      data = {"x_label": str, "y_label": str,
              "points": [{"x": <number>, "y": <number>}, ...]}

    - "heatmap_grid": a 3x3 grid of a value over the strike zone (e.g.
      whiff rate or xwOBA by location). row 0 = high, row 2 = low;
      col 0 = away, col 2 = in (away/in relative to the batter's stand).
      data = {"legend_label": str,
              "cells": [{"row": 0-2, "col": 0-2, "value": <number>}, ...]}
              (up to 9 cells, one per row/col combination)

    - "spray_chart": where batted balls landed on the field. Requires
      hc_x, hc_y from statcast (only present on batted-ball rows).
      data = {"points": [{"hc_x": <number>, "hc_y": <number>,
                           "label": <optional outcome, e.g. "home_run">}, ...]}

    - "trajectory": the flight path of one or more pitches from release
      to plate, colored by pitch type. Requires vx0/vy0/vz0/ax/ay/az and
      release_pos_x/y/z from statcast.
      data = {"pitches": [{"pitch_type": <str>,
                            "release_pos_x": <number>, "release_pos_y": <number>, "release_pos_z": <number>,
                            "vx0": <number>, "vy0": <number>, "vz0": <number>,
                            "ax": <number>, "ay": <number>, "az": <number>}, ...]}

    - "stat_row": a row of a few named KPI tiles (e.g. whiff rate, xwOBA,
      avg exit velo, chase rate) — use this for a quick summary at the
      top of a multi-chart breakdown, not for a single number (that's
      just plain text per rule 12) or a series (that's "line" or "bar").
      data = {"stats": [{"label": <str>, "value": <number>,
                          "format": one of "percent","decimal","mph","number","signed"}, ...]}
              (format controls display only, e.g. "percent" -> "41.4%",
              "decimal" -> ".265", "signed" -> "+0.02")

    Args:
        chart_type: One of "line", "bar", "scatter", "heatmap_grid",
            "spray_chart", "trajectory", "stat_row".
        data: The data structure matching chart_type, as documented above.
        title: Optional short title to display above the chart.
    """
    if chart_type not in CHART_DATA_SHAPES:
        raise ValueError(f"chart_type must be one of {list(CHART_DATA_SHAPES)}, got '{chart_type}'.")

    missing = [key for key in CHART_DATA_SHAPES[chart_type] if key not in data]
    if missing:
        raise ValueError(f"data for chart_type '{chart_type}' is missing required key(s): {missing}")

    return {"chart_type": chart_type, "data": data, "title": title}


final_answer = FinalAnswerTool()

model = OpenAIServerModel(
max_tokens=4096,
temperature=0.5,
model_id='gpt-4o', # multi-tool orchestration (render_chart bundles, matchup_leaderboard,
                    # player_stat_line) is exactly the "tougher task" gpt-4o-mini struggled
                    # with — it kept skipping render_chart in favor of a longer text answer
                    # even with explicit rules and a worked example. Raised max_tokens too,
                    # since a multi-chart step's output (several render_chart calls with
                    # real data payloads) could otherwise get close to the old 2096 cap.
api_key=os.environ["OPENAI_API_KEY"],
)


# Import tool from Hub
#image_generation_tool = load_tool("agents-course/text-to-image", trust_remote_code=True)

with open(BASE_DIR / "prompt.yaml", 'r') as stream:
    prompt_templates = yaml.safe_load(stream)

tools_list = [
    final_answer,
    run_sql_query,
    player_stat_line,
    matchup_leaderboard,
    create_baseball_chart,
    render_chart,
]


agent = CodeAgent(
    model=model,
    tools= tools_list,  ## add your tools here (don't remove final answer)
    max_steps=6,
    verbosity_level=1,
    planning_interval=None,
    name=None,
    description=None,
    prompt_templates=prompt_templates
)
