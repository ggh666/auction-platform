ALTER TABLE auction_assets
  ADD COLUMN item_category VARCHAR(40) NULL AFTER asset_type,
  ADD COLUMN dragon_ball_profession VARCHAR(20) NULL AFTER item_category,
  ADD COLUMN dragon_ball_quality VARCHAR(20) NULL AFTER dragon_ball_profession,
  ADD COLUMN dragon_ball_attributes VARCHAR(200) NULL AFTER dragon_ball_quality;
