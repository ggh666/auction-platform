CREATE TABLE IF NOT EXISTS principals (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  admin_id BIGINT UNSIGNED NOT NULL UNIQUE,
  display_name VARCHAR(64) NOT NULL,
  disabled_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_principals_active (disabled_at, display_name),
  CONSTRAINT fk_principals_admin FOREIGN KEY (admin_id) REFERENCES admin_users(id)
);

ALTER TABLE auction_assets
  ADD COLUMN principal_id BIGINT UNSIGNED NULL AFTER seller_id,
  ADD INDEX idx_asset_principal (principal_id, status, created_at),
  ADD CONSTRAINT fk_assets_principal FOREIGN KEY (principal_id) REFERENCES principals(id);
