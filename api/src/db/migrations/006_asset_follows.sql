CREATE TABLE IF NOT EXISTS asset_follows (
  user_id BIGINT UNSIGNED NOT NULL,
  asset_id BIGINT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, asset_id),
  INDEX idx_asset_follows_user_created (user_id, created_at),
  INDEX idx_asset_follows_asset_created (asset_id, created_at),
  CONSTRAINT fk_asset_follows_user FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT fk_asset_follows_asset FOREIGN KEY (asset_id) REFERENCES auction_assets(id)
);
