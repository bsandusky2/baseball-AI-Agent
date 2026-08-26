import duckdb

DB_PATH = "data/baseball.duckdb"

con = duckdb.connect(DB_PATH)

con.execute("""
CREATE OR REPLACE TABLE players AS

WITH pitcher_names AS (
    SELECT
        pitcher AS player_id,
        player_name
    FROM raw_statcast
    WHERE pitcher IS NOT NULL
      AND player_name IS NOT NULL
    GROUP BY pitcher, player_name
)

SELECT
    player_id,
    player_name

FROM pitcher_names
ORDER BY player_id
""")

print("Created players table.")

count = con.execute("""
    SELECT COUNT(*)
    FROM players
""").fetchone()[0]

print(f"{count:,} players")

print("\nSample:")

result = con.execute("""
    SELECT *
    FROM players
    ORDER BY player_name
    LIMIT 20
""").fetchall()

for row in result:
    print(row)

con.close()