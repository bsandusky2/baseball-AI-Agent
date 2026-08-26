import pandas as pd

file = "data/raw/statcast_2025_04.parquet"

df = pd.read_parquet(file)

print("\nShape:")
print(df.shape)

print("\nColumns:")
for column in df.columns:
    print(column)

print("\nFirst 5 rows:")
print(df.head())