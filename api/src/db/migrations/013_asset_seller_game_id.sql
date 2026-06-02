ALTER TABLE auction_assets
  ADD COLUMN seller_game_id VARCHAR(80) NULL AFTER seller_id;
