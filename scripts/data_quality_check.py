import duckdb

con = duckdb.connect("data/baseball.duckdb")

queries = {

    "Total pitches":
    """
    SELECT COUNT(*)
    FROM statcast
    """,

    "Null pitch type":
    """
    SELECT COUNT(*)
    FROM statcast
    WHERE pitch_type IS NULL
    """,

    "Null velocity":
    """
    SELECT COUNT(*)
    FROM statcast
    WHERE release_speed IS NULL
    """,

    "Null spin":
    """
    SELECT COUNT(*)
    FROM statcast
    WHERE release_spin_rate IS NULL
    """,

    "Null batter":
    """
    SELECT COUNT(*)
    FROM statcast
    WHERE batter IS NULL
    """,

    "Null pitcher":
    """
    SELECT COUNT(*)
    FROM statcast
    WHERE pitcher IS NULL
    """,

    "Batted balls":
    """
    SELECT COUNT(*)
    FROM statcast
    WHERE launch_speed IS NOT NULL
    """,

    "Swings":
    """
    SELECT COUNT(*)
    FROM statcast
    WHERE description IN (
        'swinging_strike',
        'swinging_strike_blocked',
        'foul',
        'foul_tip',
        'hit_into_play',
        'hit_into_play_no_out',
        'hit_into_play_score'
    )
    """
}

for name, query in queries.items():
    result = con.execute(query).fetchone()[0]
    print(f"{name:25} {result:,}")

con.close()