from pathlib import Path
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
import duckdb

DB_PATH = Path(__file__).resolve().parent.parent / "data" / "baseball.duckdb"
SEARCH_RESULTS_LIMIT = 20

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["GET"],
    allow_headers=["*"],
)

# Single shared read-only connection, opened once — same pattern as app.py.
con = duckdb.connect(str(DB_PATH), read_only=True)


@app.get("/players")
def get_players(search: str | None = Query(default=None)):
    # A separate cursor per request keeps concurrent requests from
    # stepping on each other's query state on the shared connection.
    cursor = con.cursor()

    if search:
        rows = cursor.execute(
            """
            SELECT p.player_id, p.first_name, p.last_name
            FROM players p
            WHERE (p.player_id IN (SELECT batter FROM statcast)
                OR p.player_id IN (SELECT pitcher FROM statcast))
              AND strip_accents(p.first_name || ' ' || p.last_name) ILIKE strip_accents(?)
            ORDER BY p.last_name, p.first_name
            LIMIT ?
            """,
            [f"%{search}%", SEARCH_RESULTS_LIMIT],
        ).fetchall()
    else:
        rows = cursor.execute(
            """
            SELECT p.player_id, p.first_name, p.last_name
            FROM players p
            WHERE p.player_id IN (SELECT batter FROM statcast)
               OR p.player_id IN (SELECT pitcher FROM statcast)
            ORDER BY p.last_name, p.first_name
            """
        ).fetchall()

    return [
        {"id": player_id, "name": f"{first_name} {last_name}"}
        for player_id, first_name, last_name in rows
    ]

#Get BA, SLUG %, OBP%, Whiff Rate, Chase Rate, Barrel rate, Average Exit Velo Rate
@app.get("/kpi/{player_id}")
def get_static_kpi(player_id: int):
    cursor = con.cursor()

    row = cursor.execute(
        """
        SELECT
            COUNT(*) AS pitches_analyzed,
            SUM(COALESCE(estimated_woba_using_speedangle, woba_value))::DOUBLE
                / NULLIF(SUM(woba_denom), 0) AS xwoba,
            SUM(is_whiff)::DOUBLE / NULLIF(SUM(is_swing), 0) AS whiff_rate,
            SUM(CASE WHEN is_swing AND zone > 9 THEN 1 ELSE 0 END)::DOUBLE
                / NULLIF(SUM(CASE WHEN zone > 9 THEN 1 ELSE 0 END), 0) AS chase_rate,
            AVG(launch_speed) FILTER (WHERE is_batted_ball) AS avg_exit_velocity,
            SUM(CASE WHEN launch_speed_angle = 6 THEN 1 ELSE 0 END)::DOUBLE
                / NULLIF(SUM(CASE WHEN is_batted_ball THEN 1 ELSE 0 END), 0) AS barrel_rate,
            AVG(delta_run_exp) AS run_value
        FROM statcast
        WHERE batter = ?
        """,
        [player_id],
    ).fetchone()

    (
        pitches_analyzed,
        xwoba,
        whiff_rate,
        chase_rate,
        avg_exit_velocity,
        barrel_rate,
        run_value,
    ) = row

    return {
        "player_id": player_id,
        "pitches_analyzed": {"value": pitches_analyzed},
        "xwoba": {"value": xwoba},
        "whiff_rate": {"value": whiff_rate},
        "chase_rate": {"value": chase_rate},
        "avg_exit_velocity": {"value": avg_exit_velocity},
        "barrel_rate": {"value": barrel_rate},
        "run_value": {"value": run_value},
    }

HEATMAP_METRICS = {
    "whiff_rate": "SUM(is_whiff)::DOUBLE / NULLIF(SUM(is_swing), 0)",
    "xwoba": "SUM(COALESCE(estimated_woba_using_speedangle, woba_value))::DOUBLE"
              " / NULLIF(SUM(woba_denom), 0)",
}


# 3x3 location grid. Row 0 = high, row 2 = low, using each pitch's fraction
# of the way up this specific batter's own strike zone (sz_bot/sz_top), so it
# adapts to their stance instead of a fixed absolute height. Col 0 = away,
# col 2 = in, using plate_x flipped by batter handedness (stand) — plate_x's
# sign means opposite things for a lefty vs a righty, so raw plate_x alone
# can't tell you away/in without knowing which side the batter stands on.
@app.get("/kpi/{player_id}/heatmap")
def get_heatmap(player_id: int, metric: str = Query(default="whiff_rate")):
    if metric not in HEATMAP_METRICS:
        raise HTTPException(status_code=400, detail=f"Unknown metric '{metric}'")

    cursor = con.cursor()
    metric_expr = HEATMAP_METRICS[metric]

    rows = cursor.execute(
        f"""
        WITH pitches AS (
            SELECT
                *,
                CASE WHEN stand = 'R' THEN plate_x ELSE -plate_x END AS signed_x,
                (plate_z - sz_bot) / NULLIF(sz_top - sz_bot, 0) AS zone_fraction
            FROM statcast
            WHERE batter = ?
              AND plate_x IS NOT NULL AND plate_z IS NOT NULL
              AND sz_top IS NOT NULL AND sz_bot IS NOT NULL
        ),
        binned AS (
            SELECT
                *,
                CASE
                    WHEN zone_fraction > 0.667 THEN 0
                    WHEN zone_fraction < 0.333 THEN 2
                    ELSE 1
                END AS row,
                CASE
                    WHEN signed_x > 0.28 THEN 0
                    WHEN signed_x < -0.28 THEN 2
                    ELSE 1
                END AS col
            FROM pitches
        )
        SELECT row, col, {metric_expr} AS value
        FROM binned
        GROUP BY row, col
        """,
        [player_id],
    ).fetchall()

    cells = [{"row": r, "col": c, "value": v} for r, c, v in rows if v is not None]
    values = [cell["value"] for cell in cells]

    return {
        "player_id": player_id,
        "metric": metric,
        "scale_min": min(values) if values else 0,
        "scale_max": max(values) if values else 1,
        "cells": cells,
    }


# xwOBA bucketed by pitch velocity (5 mph buckets), with a +/- 1 stddev band.
# Only counts pitches that ended the plate appearance (woba_denom > 0) —
# estimated_woba_using_speedangle only applies to batted balls, so this
# blends in actual woba_value for the outcomes that can't be "estimated"
# (walks, strikeouts), same as the xwOBA calc in get_static_kpi.
@app.get("/kpi/{player_id}/velocity")
def get_velocity_chart(player_id: int):
    cursor = con.cursor()

    rows = cursor.execute(
        """
        WITH pa_pitches AS (
            SELECT
                release_speed,
                COALESCE(estimated_woba_using_speedangle, woba_value) AS woba
            FROM statcast
            WHERE batter = ? AND woba_denom > 0 AND release_speed IS NOT NULL
        )
        SELECT
            FLOOR(release_speed / 5) * 5 + 2.5 AS velocity_bucket,
            AVG(woba) AS xwoba,
            AVG(woba) - COALESCE(STDDEV(woba), 0) AS low,
            AVG(woba) + COALESCE(STDDEV(woba), 0) AS high
        FROM pa_pitches
        GROUP BY velocity_bucket
        HAVING COUNT(*) >= 5
        ORDER BY velocity_bucket
        """,
        [player_id],
    ).fetchall()

    return {
        "player_id": player_id,
        "points": [
            {
                "velocity": round(velocity, 1),
                "xwoba": xwoba,
                "low": max(0.0, low),
                "high": high,
            }
            for velocity, xwoba, low, high in rows
        ],
    }


# Whiff rate bucketed by spin rate (100 rpm buckets) on swings only, plus a
# linear trend line via DuckDB's built-in regression aggregates.
@app.get("/kpi/{player_id}/spin-rate")
def get_spin_rate_chart(player_id: int):
    cursor = con.cursor()

    points = cursor.execute(
        """
        WITH swings AS (
            SELECT release_spin_rate, is_whiff
            FROM statcast
            WHERE batter = ? AND is_swing AND release_spin_rate IS NOT NULL
        )
        SELECT
            FLOOR(release_spin_rate / 100) * 100 + 50 AS spin_bucket,
            AVG(is_whiff::DOUBLE) AS whiff_rate
        FROM swings
        GROUP BY spin_bucket
        HAVING COUNT(*) >= 3
        ORDER BY spin_bucket
        """,
        [player_id],
    ).fetchall()

    slope, intercept, min_spin, max_spin = cursor.execute(
        """
        SELECT
            regr_slope(is_whiff::DOUBLE, release_spin_rate),
            regr_intercept(is_whiff::DOUBLE, release_spin_rate),
            MIN(release_spin_rate),
            MAX(release_spin_rate)
        FROM statcast
        WHERE batter = ? AND is_swing AND release_spin_rate IS NOT NULL
        """,
        [player_id],
    ).fetchone()

    trend_line = []
    if slope is not None and min_spin is not None:
        trend_line = [
            {
                "spin_rate": min_spin,
                "whiff_rate": max(0.0, min(1.0, slope * min_spin + intercept)),
            },
            {
                "spin_rate": max_spin,
                "whiff_rate": max(0.0, min(1.0, slope * max_spin + intercept)),
            },
        ]

    return {
        "player_id": player_id,
        "points": [
            {"spin_rate": round(bucket), "whiff_rate": whiff_rate} for bucket, whiff_rate in points
        ],
        "trend_line": trend_line,
    }
