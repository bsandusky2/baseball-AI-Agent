import duckdb

DB_PATH = "data/baseball.duckdb"

con = duckdb.connect(DB_PATH)

con.execute("""
CREATE OR REPLACE TABLE hitter_pitch_stats AS

SELECT

    batter,
    game_year AS season,

    -- Batter / pitcher handedness
    stand,
    p_throws,

    -- Pitch
    pitch_type,
    ANY_VALUE(pitch_name) AS pitch_name,

    -- Volume
    COUNT(*) AS pitches,

    COUNT(DISTINCT game_pk) AS games,

    -- Swing behavior
    SUM(
        CASE WHEN is_swing THEN 1 ELSE 0 END
    ) AS swings,

    SUM(
        CASE WHEN is_whiff THEN 1 ELSE 0 END
    ) AS whiffs,

    SUM(
        CASE WHEN is_batted_ball THEN 1 ELSE 0 END
    ) AS batted_balls,

    SUM(
        CASE WHEN is_called_strike THEN 1 ELSE 0 END
    ) AS called_strikes,

    -- Pitch characteristics
    AVG(release_speed) AS avg_velocity,

    AVG(release_spin_rate) AS avg_spin,

    AVG(pfx_x) AS avg_horizontal_break,

    AVG(pfx_z) AS avg_vertical_break,

    -- Contact
    AVG(
        CASE
            WHEN is_batted_ball
            THEN launch_speed
        END
    ) AS avg_exit_velocity,

    AVG(
        CASE
            WHEN is_batted_ball
            THEN launch_angle
        END
    ) AS avg_launch_angle,

    AVG(
        CASE
            WHEN is_batted_ball
            THEN hit_distance_sc
        END
    ) AS avg_hit_distance,

    -- Expected outcomes
    AVG(
        CASE
            WHEN woba_value IS NOT NULL
            THEN estimated_ba_using_speedangle
        END
    ) AS xba,

    AVG(
        CASE
            WHEN woba_value IS NOT NULL
            THEN estimated_woba_using_speedangle
        END
    ) AS xwoba,

    AVG(
        CASE
            WHEN woba_value IS NOT NULL
            THEN estimated_slg_using_speedangle
        END
    ) AS xslg,

    -- Run value
    SUM(
        COALESCE(delta_run_exp, 0)
    ) AS run_value

FROM statcast

WHERE
    batter IS NOT NULL
    AND pitch_type IS NOT NULL

GROUP BY

    batter,
    game_year,
    stand,
    p_throws,
    pitch_type
""")

count = con.execute("""
    SELECT COUNT(*)
    FROM hitter_pitch_stats
""").fetchone()[0]

print(f"Created hitter_pitch_stats: {count:,} rows")

print("\nJudge test:")

print(con.sql("""
    SELECT
        p.first_name || ' ' || p.last_name AS player_name,
        h.season,
        h.stand,
        h.p_throws,
        h.pitch_type,
        h.pitch_name,
        h.pitches,
        h.swings,
        h.whiffs,
        h.avg_velocity,
        h.avg_spin
    FROM hitter_pitch_stats h
    JOIN players p
        ON h.batter = p.player_id
    WHERE p.first_name = 'Aaron' AND p.last_name = 'Judge'
    ORDER BY h.pitches DESC
"""))

con.close()