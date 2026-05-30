CREATE TABLE IF NOT EXISTS station_notifications (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  type ENUM('outbid') NOT NULL,
  asset_id BIGINT UNSIGNED NOT NULL,
  bid_id BIGINT UNSIGNED NOT NULL,
  actor_user_id BIGINT UNSIGNED NOT NULL,
  actor_display_name VARCHAR(64) NOT NULL,
  asset_title VARCHAR(120) NOT NULL,
  amount_cents BIGINT UNSIGNED NOT NULL,
  read_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_notifications_user (user_id, created_at),
  INDEX idx_notifications_asset (asset_id, created_at),
  CONSTRAINT fk_notifications_user FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT fk_notifications_asset FOREIGN KEY (asset_id) REFERENCES auction_assets(id),
  CONSTRAINT fk_notifications_bid FOREIGN KEY (bid_id) REFERENCES bids(id),
  CONSTRAINT fk_notifications_actor FOREIGN KEY (actor_user_id) REFERENCES users(id)
);
