import duckdb

con = duckdb.connect("data/baseball.duckdb")

result = con.execute("""
SELECT
    pitch_type,
    pitch_name,
    pitches,
    swings,
    whiffs,

    ROUND(
        CAST(whiffs AS DOUBLE)
        / NULLIF(swings, 0),
        3
    ) AS whiff_rate,

    ROUND(avg_velocity, 1) AS avg_velocity,
    ROUND(avg_spin, 0) AS avg_spin,

    ROUND(xwoba, 3) AS xwoba,
    ROUND(woba, 3) AS woba,

    ROUND(avg_exit_velocity, 1) AS avg_exit_velocity

FROM hitter_pitch_stats

WHERE
    batter = ?
    AND season = 2025

ORDER BY pitches DESC
""", [592450])

print(result.fetchall())