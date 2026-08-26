import duckdb

con = duckdb.connect("data/baseball.duckdb")


print(con.sql("""
        SELECT AVG(release_speed), pitcher, player_name AS pitcher_name, pitch_name, pitch_type
        FROM statcast
        GROUP BY pitcher, player_name, pitch_name, pitch_type
        ORDER BY pitcher_name
    """))

con.close()
