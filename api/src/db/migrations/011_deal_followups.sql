-- Add成交跟进单和买家失联出价限制字段。

SET @buyer_unreachable_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'users'
    AND COLUMN_NAME = 'buyer_unreachable_count'
);

SET @add_buyer_unreachable_sql := IF(
  @buyer_unreachable_exists = 0,
  'ALTER TABLE users ADD COLUMN buyer_unreachable_count INT UNSIGNED NOT NULL DEFAULT 0 AFTER daily_publish_limit',
  'SELECT 1'
);
PREPARE add_buyer_unreachable_stmt FROM @add_buyer_unreachable_sql;
EXECUTE add_buyer_unreachable_stmt;
DEALLOCATE PREPARE add_buyer_unreachable_stmt;

SET @bid_restricted_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'users'
    AND COLUMN_NAME = 'bid_restricted_until'
);

SET @add_bid_restricted_sql := IF(
  @bid_restricted_exists = 0,
  'ALTER TABLE users ADD COLUMN bid_restricted_until DATETIME NULL AFTER buyer_unreachable_count',
  'SELECT 1'
);
PREPARE add_bid_restricted_stmt FROM @add_bid_restricted_sql;
EXECUTE add_bid_restricted_stmt;
DEALLOCATE PREPARE add_bid_restricted_stmt;

CREATE TABLE IF NOT EXISTS deal_followups (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  asset_id BIGINT UNSIGNED NOT NULL UNIQUE,
  principal_id BIGINT UNSIGNED NULL,
  seller_id BIGINT UNSIGNED NOT NULL,
  buyer_id BIGINT UNSIGNED NOT NULL,
  final_price_cents BIGINT UNSIGNED NOT NULL,
  status ENUM('pending_buyer_confirm','buyer_confirmed','buyer_abandoned','principal_contacted','buyer_unreachable','completed','cancelled') NOT NULL DEFAULT 'pending_buyer_confirm',
  note VARCHAR(500) NULL,
  buyer_confirmed_at DATETIME NULL,
  buyer_abandoned_at DATETIME NULL,
  principal_contacted_at DATETIME NULL,
  buyer_unreachable_at DATETIME NULL,
  completed_at DATETIME NULL,
  cancelled_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_deal_followups_principal (principal_id, status, updated_at, id),
  INDEX idx_deal_followups_buyer (buyer_id, status, updated_at, id),
  INDEX idx_deal_followups_seller (seller_id, updated_at, id),
  CONSTRAINT fk_deal_followups_asset FOREIGN KEY (asset_id) REFERENCES auction_assets(id),
  CONSTRAINT fk_deal_followups_principal FOREIGN KEY (principal_id) REFERENCES principals(id),
  CONSTRAINT fk_deal_followups_seller FOREIGN KEY (seller_id) REFERENCES users(id),
  CONSTRAINT fk_deal_followups_buyer FOREIGN KEY (buyer_id) REFERENCES users(id)
);

ALTER TABLE users
  ADD INDEX idx_users_bid_restricted (bid_restricted_until, id);

ALTER TABLE auction_assets
  ADD INDEX idx_assets_followup_candidates (principal_id, effective_end_at, status, highest_bidder_id, updated_at, id);
