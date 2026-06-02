-- Destructive initialization script.
-- Running this file will drop all auction platform tables and recreate them.
-- Use only for first-time setup, empty environments, or intentional test resets.
SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS admin_operation_logs;
DROP TABLE IF EXISTS system_configs;
DROP TABLE IF EXISTS violation_records;
DROP TABLE IF EXISTS reports;
DROP TABLE IF EXISTS auction_results;
DROP TABLE IF EXISTS deal_followups;
DROP TABLE IF EXISTS station_notifications;
DROP TABLE IF EXISTS asset_follows;
DROP TABLE IF EXISTS bids;
DROP TABLE IF EXISTS content_safety_image_checks;
DROP TABLE IF EXISTS asset_images;
DROP TABLE IF EXISTS auction_assets;
DROP TABLE IF EXISTS principals;
DROP TABLE IF EXISTS admin_users;
DROP TABLE IF EXISTS users;

SET FOREIGN_KEY_CHECKS = 1;

CREATE TABLE users (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  openid VARCHAR(128) NULL UNIQUE,
  display_name VARCHAR(64) NOT NULL,
  avatar_url VARCHAR(512) NULL,
  banned_at DATETIME NULL,
  ban_reason VARCHAR(255) NULL,
  violation_count INT NOT NULL DEFAULT 0,
  credit_score INT UNSIGNED NOT NULL DEFAULT 100,
  credit_reset_at DATETIME NULL,
  daily_publish_limit INT UNSIGNED NULL,
  buyer_unreachable_count INT UNSIGNED NOT NULL DEFAULT 0,
  bid_restricted_until DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE admin_users (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  username VARCHAR(64) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('super_admin','reviewer','operator') NOT NULL,
  disabled_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE principals (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  admin_id BIGINT UNSIGNED NOT NULL UNIQUE,
  display_name VARCHAR(64) NOT NULL,
  disabled_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_principals_active (disabled_at, display_name),
  CONSTRAINT fk_principals_admin FOREIGN KEY (admin_id) REFERENCES admin_users(id)
);

CREATE TABLE auction_assets (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  seller_id BIGINT UNSIGNED NOT NULL,
  seller_game_id VARCHAR(80) NULL,
  principal_id BIGINT UNSIGNED NULL,
  game_name VARCHAR(80) NOT NULL,
  server_name VARCHAR(80) NOT NULL,
  asset_type VARCHAR(80) NOT NULL,
  item_category VARCHAR(40) NULL,
  dragon_ball_profession VARCHAR(20) NULL,
  dragon_ball_quality VARCHAR(20) NULL,
  dragon_ball_attributes VARCHAR(200) NULL,
  title VARCHAR(120) NOT NULL,
  description TEXT NOT NULL,
  status ENUM('draft','pending_review','active','ended','rejected','cancelled','removed') NOT NULL,
  starting_price_cents BIGINT UNSIGNED NOT NULL,
  current_price_cents BIGINT UNSIGNED NULL,
  min_increment_cents BIGINT UNSIGNED NOT NULL,
  highest_bidder_id BIGINT UNSIGNED NULL,
  original_end_at DATETIME NOT NULL,
  effective_end_at DATETIME NOT NULL,
  reviewed_by BIGINT UNSIGNED NULL,
  reviewed_at DATETIME NULL,
  review_note VARCHAR(500) NULL,
  ended_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_asset_list (status, game_name, server_name, asset_type, effective_end_at, created_at),
  INDEX idx_asset_principal (principal_id, status, created_at),
  INDEX idx_asset_seller (seller_id, created_at),
  CONSTRAINT fk_assets_seller FOREIGN KEY (seller_id) REFERENCES users(id),
  CONSTRAINT fk_assets_principal FOREIGN KEY (principal_id) REFERENCES principals(id),
  CONSTRAINT fk_assets_highest_bidder FOREIGN KEY (highest_bidder_id) REFERENCES users(id),
  CONSTRAINT fk_assets_reviewer FOREIGN KEY (reviewed_by) REFERENCES admin_users(id)
);

CREATE TABLE asset_images (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  asset_id BIGINT UNSIGNED NULL,
  uploader_id BIGINT UNSIGNED NOT NULL,
  object_key VARCHAR(255) NOT NULL,
  public_url VARCHAR(512) NOT NULL,
  mime_type VARCHAR(80) NOT NULL,
  size_bytes INT UNSIGNED NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_images_asset (asset_id, sort_order),
  INDEX idx_images_uploader (uploader_id, created_at),
  CONSTRAINT fk_images_asset FOREIGN KEY (asset_id) REFERENCES auction_assets(id),
  CONSTRAINT fk_images_uploader FOREIGN KEY (uploader_id) REFERENCES users(id)
);

CREATE TABLE asset_follows (
  user_id BIGINT UNSIGNED NOT NULL,
  asset_id BIGINT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, asset_id),
  INDEX idx_asset_follows_user_created (user_id, created_at),
  INDEX idx_asset_follows_asset_created (asset_id, created_at),
  CONSTRAINT fk_asset_follows_user FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT fk_asset_follows_asset FOREIGN KEY (asset_id) REFERENCES auction_assets(id)
);

CREATE TABLE content_safety_image_checks (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  uploader_id BIGINT UNSIGNED NOT NULL,
  object_key VARCHAR(255) NOT NULL,
  public_url VARCHAR(512) NOT NULL,
  status ENUM('pending','pass','review','risky','failed') NOT NULL DEFAULT 'pending',
  trace_id VARCHAR(128) NULL,
  label INT NULL,
  detail_json JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_content_safety_public_url (public_url),
  UNIQUE KEY uq_content_safety_trace (trace_id),
  INDEX idx_content_safety_status (status, updated_at),
  INDEX idx_content_safety_uploader (uploader_id, created_at),
  CONSTRAINT fk_content_safety_uploader FOREIGN KEY (uploader_id) REFERENCES users(id)
);

CREATE TABLE bids (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  asset_id BIGINT UNSIGNED NOT NULL,
  bidder_id BIGINT UNSIGNED NOT NULL,
  amount_cents BIGINT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_bids_asset (asset_id, created_at),
  INDEX idx_bids_bidder (bidder_id, created_at),
  CONSTRAINT fk_bids_asset FOREIGN KEY (asset_id) REFERENCES auction_assets(id),
  CONSTRAINT fk_bids_bidder FOREIGN KEY (bidder_id) REFERENCES users(id)
);

CREATE TABLE station_notifications (
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

CREATE TABLE auction_results (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  asset_id BIGINT UNSIGNED NOT NULL UNIQUE,
  seller_id BIGINT UNSIGNED NOT NULL,
  winner_id BIGINT UNSIGNED NULL,
  final_price_cents BIGINT UNSIGNED NULL,
  status ENUM('sold','unsold','cancelled','removed') NOT NULL,
  ended_at DATETIME NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_results_asset FOREIGN KEY (asset_id) REFERENCES auction_assets(id),
  CONSTRAINT fk_results_seller FOREIGN KEY (seller_id) REFERENCES users(id),
  CONSTRAINT fk_results_winner FOREIGN KEY (winner_id) REFERENCES users(id)
);

CREATE TABLE deal_followups (
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

CREATE TABLE reports (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  reporter_id BIGINT UNSIGNED NOT NULL,
  target_user_id BIGINT UNSIGNED NOT NULL,
  asset_id BIGINT UNSIGNED NULL,
  result_id BIGINT UNSIGNED NULL,
  reason VARCHAR(120) NOT NULL,
  evidence TEXT NOT NULL,
  status ENUM('pending','rejected','confirmed') NOT NULL DEFAULT 'pending',
  reviewed_by BIGINT UNSIGNED NULL,
  reviewed_at DATETIME NULL,
  review_note VARCHAR(500) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_reports_status (status, created_at),
  INDEX idx_reports_target (target_user_id, created_at),
  CONSTRAINT fk_reports_reporter FOREIGN KEY (reporter_id) REFERENCES users(id),
  CONSTRAINT fk_reports_target FOREIGN KEY (target_user_id) REFERENCES users(id),
  CONSTRAINT fk_reports_asset FOREIGN KEY (asset_id) REFERENCES auction_assets(id),
  CONSTRAINT fk_reports_result FOREIGN KEY (result_id) REFERENCES auction_results(id),
  CONSTRAINT fk_reports_reviewer FOREIGN KEY (reviewed_by) REFERENCES admin_users(id)
);

CREATE TABLE violation_records (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  report_id BIGINT UNSIGNED NULL,
  title VARCHAR(120) NOT NULL,
  description TEXT NOT NULL,
  published_by BIGINT UNSIGNED NOT NULL,
  published_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_violations_user (user_id, published_at),
  CONSTRAINT fk_violations_user FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT fk_violations_report FOREIGN KEY (report_id) REFERENCES reports(id),
  CONSTRAINT fk_violations_publisher FOREIGN KEY (published_by) REFERENCES admin_users(id)
);

CREATE TABLE admin_operation_logs (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  admin_id BIGINT UNSIGNED NOT NULL,
  action VARCHAR(80) NOT NULL,
  target_type VARCHAR(80) NOT NULL,
  target_id BIGINT UNSIGNED NOT NULL,
  detail_json JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_admin_logs_target (target_type, target_id, created_at),
  CONSTRAINT fk_admin_logs_admin FOREIGN KEY (admin_id) REFERENCES admin_users(id)
);

CREATE TABLE system_configs (
  config_key VARCHAR(80) PRIMARY KEY,
  config_value VARCHAR(500) NOT NULL,
  updated_by BIGINT UNSIGNED NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_system_configs_updater FOREIGN KEY (updated_by) REFERENCES admin_users(id)
);

INSERT INTO system_configs (config_key, config_value) VALUES
  ('default_min_increment_cents', '100'),
  ('extension_window_seconds', '300'),
  ('extension_duration_seconds', '300'),
  ('max_images_per_asset', '9'),
  ('max_image_size_bytes', '5242880'),
  ('default_daily_publish_limit', '3');
