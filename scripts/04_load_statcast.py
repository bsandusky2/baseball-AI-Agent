import duckdb

DB_PATH = "data/baseball.duckdb"
PARQUET_FILE = "data/raw/statcast_2020_2025.parquet"

con = duckdb.connect(DB_PATH)

con.execute("""
    CREATE TABLE IF NOT EXISTS statcast AS
    SELECT *
    FROM read_parquet(?)
""", [PARQUET_FILE])

count = con.execute("""
    SELECT COUNT(*)
    FROM statcast
""").fetchone()[0]

print(f"Loaded {count:,} pitches")

con.close()