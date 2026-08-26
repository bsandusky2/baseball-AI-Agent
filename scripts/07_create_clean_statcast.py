import duckdb

DB_PATH = "data/baseball.duckdb"

con = duckdb.connect(DB_PATH)

con.execute("""
CREATE OR REPLACE TABLE statcast AS
SELECT

    -- ============================================================
    -- Identity
    -- ============================================================

    game_pk,
    game_date,
    game_year,
    game_type,
    at_bat_number,
    pitch_number,

    -- ============================================================
    -- Players
    -- ============================================================

    batter,
    pitcher,
    player_name,

    -- ============================================================
    -- Pitch characteristics
    -- ============================================================

    pitch_type,
    pitch_name,

    release_speed,
    effective_speed,
    release_spin_rate,
    spin_axis,

    pfx_x,
    pfx_z,

    release_pos_x,
    release_pos_y,
    release_pos_z,
    release_extension,

    api_break_z_with_gravity,
    api_break_x_arm,
    api_break_x_batter_in,

    -- ============================================================
    -- Batter / pitcher context
    -- ============================================================

    stand,
    p_throws,

    balls,
    strikes,

    n_thruorder_pitcher,

    -- ============================================================
    -- Pitch location
    -- ============================================================

    zone,
    plate_x,
    plate_z,
    sz_top,
    sz_bot,

    -- ============================================================
    -- Outcome
    -- ============================================================

    events,
    description,
    type,

    hit_location,
    bb_type,

    launch_speed,
    launch_angle,
    hit_distance_sc,
    launch_speed_angle,

    -- ============================================================
    -- Expected results
    -- ============================================================

    estimated_ba_using_speedangle,
    estimated_woba_using_speedangle,
    estimated_slg_using_speedangle,

    woba_value,
    woba_denom,
    babip_value,
    iso_value,

    delta_run_exp,

    -- ============================================================
    -- Game situation
    -- ============================================================

    inning,
    inning_topbot,
    outs_when_up,

    on_1b,
    on_2b,
    on_3b,

    home_team,
    away_team,

    home_score,
    away_score,

    bat_score,
    fld_score,

    home_score_diff,
    bat_score_diff,

    -- ============================================================
    -- Swing / bat tracking
    -- ============================================================

    bat_speed,
    swing_length,
    miss_distance,
    hyper_speed,

    attack_angle,
    attack_direction,
    swing_path_tilt,

    arm_angle,

    intercept_ball_minus_batter_pos_x_inches,
    intercept_ball_minus_batter_pos_y_inches

FROM raw_statcast
""")

print("Created clean statcast table.")

print(
    con.execute("""
        SELECT COUNT(*)
        FROM statcast
    """).fetchone()[0],
    "rows"
)

print("\nSchema:")
print(con.sql("DESCRIBE statcast"))

con.close()