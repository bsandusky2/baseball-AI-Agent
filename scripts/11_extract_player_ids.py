import duckdb

DB_PATH = "data/baseball.duckdb"

con = duckdb.connect(DB_PATH)

con.execute("""
CREATE OR REPLACE TABLE player_ids AS

SELECT batter AS player_id
FROM raw_statcast
WHERE batter IS NOT NULL

UNION

SELECT pitcher AS player_id
FROM raw_statcast
WHERE pitcher IS NOT NULL

ORDER BY player_id
""")

count = con.execute("""
    SELECT COUNT(*)
    FROM player_ids
""").fetchone()[0]

print(f"Found {count:,} unique players")

print("\nSample:")
print(
    con.execute("""
        SELECT *
        FROM player_ids
        LIMIT 20
    """).fetchall()
)

con.close()