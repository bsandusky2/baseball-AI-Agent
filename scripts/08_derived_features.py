import duckdb

con = duckdb.connect("data/baseball.duckdb")

con.execute("""
ALTER TABLE statcast
ADD COLUMN velocity_band VARCHAR
""")

con.execute("""
UPDATE statcast
SET velocity_band =
    CASE
        WHEN release_speed IS NULL THEN NULL
        WHEN release_speed < 90 THEN '<90'
        WHEN release_speed < 93 THEN '90-92.9'
        WHEN release_speed < 95 THEN '93-94.9'
        WHEN release_speed < 97 THEN '95-96.9'
        ELSE '97+'
    END
""")

con.execute("""
ALTER TABLE statcast
ADD COLUMN spin_band VARCHAR
""")

con.execute("""
UPDATE statcast
SET spin_band =
    CASE
        WHEN release_spin_rate IS NULL THEN NULL
        WHEN release_spin_rate < 2000 THEN '<2000'
        WHEN release_spin_rate < 2200 THEN '2000-2199'
        WHEN release_spin_rate < 2400 THEN '2200-2399'
        WHEN release_spin_rate < 2600 THEN '2400-2599'
        ELSE '2600+'
    END
""")

con.execute("""
ALTER TABLE statcast
ADD COLUMN count_state VARCHAR
""")

con.execute("""
UPDATE statcast
SET count_state =
    CASE
        WHEN balls IS NULL OR strikes IS NULL THEN NULL
        ELSE CAST(balls AS VARCHAR) || '-' || CAST(strikes AS VARCHAR)
    END
""")


con.execute("""
ALTER TABLE statcast
ADD COLUMN is_swing BOOLEAN
""")

con.execute("""
UPDATE statcast
SET is_swing =
    description IN (
        'swinging_strike',
        'swinging_strike_blocked',
        'foul',
        'foul_tip',
        'hit_into_play',
        'hit_into_play_no_out',
        'hit_into_play_score'
    )
""")

con.execute("""
ALTER TABLE statcast
ADD COLUMN is_whiff BOOLEAN
""")

con.execute("""
UPDATE statcast
SET is_whiff =
    description IN (
        'swinging_strike',
        'swinging_strike_blocked'
    )
""")

con.execute("""
ALTER TABLE statcast
ADD COLUMN is_batted_ball BOOLEAN
""")

con.execute("""
UPDATE statcast
SET is_batted_ball =
    description IN (
        'hit_into_play',
        'hit_into_play_no_out',
        'hit_into_play_score'
    )
""")

con.execute("""
ALTER TABLE statcast
ADD COLUMN is_called_strike BOOLEAN
""")

con.execute("""
UPDATE statcast
SET is_called_strike =
    description = 'called_strike'
""")

import duckdb

con = duckdb.connect("data/baseball.duckdb")

print(
    con.sql("""
        SELECT
            velocity_band,
            COUNT(*) AS pitches
        FROM statcast
        GROUP BY velocity_band
        ORDER BY velocity_band
    """)
)

print(
    con.sql("""
        SELECT
            spin_band,
            COUNT(*) AS pitches
        FROM statcast
        GROUP BY spin_band
        ORDER BY spin_band
    """)
)

print(
    con.sql("""
        SELECT
            is_swing,
            is_whiff,
            is_batted_ball,
            COUNT(*) AS pitches
        FROM statcast
        GROUP BY
            is_swing,
            is_whiff,
            is_batted_ball
        ORDER BY pitches DESC
    """)
)

con.close()