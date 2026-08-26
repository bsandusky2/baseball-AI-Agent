import duckdb
import pandas as pd

DB_PATH = "data/baseball.duckdb"

REGISTER_BASE_URL = (
    "https://raw.githubusercontent.com/chadwickbureau/register/master/data/"
)
SHARDS = "0123456789abcdef"

print("Downloading Chadwick player register...")

people = pd.concat(
    (pd.read_csv(f"{REGISTER_BASE_URL}people-{shard}.csv") for shard in SHARDS),
    ignore_index=True,
)

print(f"Downloaded {len(people):,} player records")

con = duckdb.connect(DB_PATH)

con.register("people_df", people)

con.execute("""
    CREATE OR REPLACE TABLE players_raw AS
    SELECT *
    FROM people_df
""")

print("Created players_raw")

con.close()
