import duckdb

con = duckdb.connect("data/baseball.duckdb")

print("\nTables:")
print(con.sql("SHOW TABLES"))

print("\nNumber of pitches:")
print(
    con.sql("""
        SELECT COUNT(*)
        FROM statcast
    """)
)

print("\nPitch types:")
print(
    con.sql("""
        SELECT
            pitch_type,
            COUNT(*) AS pitches
        FROM statcast
        GROUP BY pitch_type
        ORDER BY pitches DESC
    """)
)

print("\nPitcher handedness:")
print(
    con.sql("""
        SELECT
            p_throws,
            COUNT(*) AS pitches
        FROM statcast
        GROUP BY p_throws
    """)
)

print("\nSchema:")
print(con.sql("DESCRIBE statcast"))

con.execute("""
    ALTER TABLE statcast
    RENAME TO raw_statcast
""")

print(con.sql("SHOW TABLES"))

con.close()