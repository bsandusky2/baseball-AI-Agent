import duckdb

DB_PATH = "data/baseball.duckdb"

con = duckdb.connect(DB_PATH)

print("DuckDB version:", con.sql("SELECT version()").fetchone()[0])

con.close()

print(f"Created database: {DB_PATH}")