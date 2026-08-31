import duckdb
import pandas as pd

# Remove the display limits for columns and width
pd.set_option('display.max_columns', None)
pd.set_option('display.width', None)

#get the tables
con = duckdb.connect("data/baseball.duckdb")
tables = con.execute("SHOW TABLES").fetchall()
print(tables)

#print all the columns in the dataframe
columns = con.sql("""
    SELECT column_name
    FROM information_schema.columns
    WHERE table_name = 'statcast'
    ORDER BY ordinal_position
""").fetchall()

for column in columns:
    print(column[0])

con.close()
