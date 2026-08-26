import duckdb

DB_PATH = "data/baseball.duckdb"

con = duckdb.connect(DB_PATH)

con.execute("""
CREATE OR REPLACE TABLE players AS
SELECT
    CAST(key_mlbam AS BIGINT) AS player_id,

    -- Names
    name_first AS first_name,
    name_last AS last_name,
    name_given AS given_name,
    name_nick AS nickname,

    -- External identifiers
    CAST(key_fangraphs AS BIGINT) AS fangraphs_id,
    key_bbref AS bbref_id,
    key_retro AS retro_id,

    -- Birth date
    CASE
        WHEN birth_year IS NOT NULL
         AND birth_month IS NOT NULL
         AND birth_day IS NOT NULL
        THEN MAKE_DATE(
            CAST(birth_year AS INTEGER),
            CAST(birth_month AS INTEGER),
            CAST(birth_day AS INTEGER)
        )
    END AS birth_date,

    -- MLB career
    CAST(mlb_played_first AS INTEGER) AS mlb_first_year,
    CAST(mlb_played_last AS INTEGER) AS mlb_last_year

FROM players_raw

WHERE key_mlbam IS NOT NULL
""")

count = con.execute("""
    SELECT COUNT(*)
    FROM players
""").fetchone()[0]

print(f"Created players table: {count:,} players")

print("\nSchema:")
print(con.sql("DESCRIBE players"))

print("\nAaron Judge:")
print(
    con.sql("""
        SELECT *
        FROM players
        WHERE player_id = 592450
    """)
)

con.close()