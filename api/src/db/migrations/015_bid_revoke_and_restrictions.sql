-- Add soft bid revocation and richer bid restriction state.

SET @bid_revoked_at_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'bids'
    AND COLUMN_NAME = 'revoked_at'
);

SET @add_bid_revoked_at_sql := IF(
  @bid_revoked_at_exists = 0,
  'ALTER TABLE bids ADD COLUMN revoked_at DATETIME NULL AFTER amount_cents',
  'SELECT 1'
);
PREPARE add_bid_revoked_at_stmt FROM @add_bid_revoked_at_sql;
EXECUTE add_bid_revoked_at_stmt;
DEALLOCATE PREPARE add_bid_revoked_at_stmt;

SET @bid_revoked_by_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'bids'
    AND COLUMN_NAME = 'revoked_by_admin_id'
);

SET @add_bid_revoked_by_sql := IF(
  @bid_revoked_by_exists = 0,
  'ALTER TABLE bids ADD COLUMN revoked_by_admin_id BIGINT UNSIGNED NULL AFTER revoked_at',
  'SELECT 1'
);
PREPARE add_bid_revoked_by_stmt FROM @add_bid_revoked_by_sql;
EXECUTE add_bid_revoked_by_stmt;
DEALLOCATE PREPARE add_bid_revoked_by_stmt;

SET @bid_revoke_reason_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'bids'
    AND COLUMN_NAME = 'revoke_reason'
);

SET @add_bid_revoke_reason_sql := IF(
  @bid_revoke_reason_exists = 0,
  'ALTER TABLE bids ADD COLUMN revoke_reason VARCHAR(255) NULL AFTER revoked_by_admin_id',
  'SELECT 1'
);
PREPARE add_bid_revoke_reason_stmt FROM @add_bid_revoke_reason_sql;
EXECUTE add_bid_revoke_reason_stmt;
DEALLOCATE PREPARE add_bid_revoke_reason_stmt;

SET @user_bid_permanent_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'users'
    AND COLUMN_NAME = 'bid_restricted_permanent'
);

SET @add_user_bid_permanent_sql := IF(
  @user_bid_permanent_exists = 0,
  'ALTER TABLE users ADD COLUMN bid_restricted_permanent TINYINT(1) NOT NULL DEFAULT 0 AFTER bid_restricted_until',
  'SELECT 1'
);
PREPARE add_user_bid_permanent_stmt FROM @add_user_bid_permanent_sql;
EXECUTE add_user_bid_permanent_stmt;
DEALLOCATE PREPARE add_user_bid_permanent_stmt;

SET @user_bid_reason_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'users'
    AND COLUMN_NAME = 'bid_restriction_reason'
);

SET @add_user_bid_reason_sql := IF(
  @user_bid_reason_exists = 0,
  'ALTER TABLE users ADD COLUMN bid_restriction_reason VARCHAR(255) NULL AFTER bid_restricted_permanent',
  'SELECT 1'
);
PREPARE add_user_bid_reason_stmt FROM @add_user_bid_reason_sql;
EXECUTE add_user_bid_reason_stmt;
DEALLOCATE PREPARE add_user_bid_reason_stmt;

SET @user_bid_started_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'users'
    AND COLUMN_NAME = 'bid_restriction_started_at'
);

SET @add_user_bid_started_sql := IF(
  @user_bid_started_exists = 0,
  'ALTER TABLE users ADD COLUMN bid_restriction_started_at DATETIME NULL AFTER bid_restriction_reason',
  'SELECT 1'
);
PREPARE add_user_bid_started_stmt FROM @add_user_bid_started_sql;
EXECUTE add_user_bid_started_stmt;
DEALLOCATE PREPARE add_user_bid_started_stmt;

SET @user_bid_admin_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'users'
    AND COLUMN_NAME = 'bid_restriction_admin_id'
);

SET @add_user_bid_admin_sql := IF(
  @user_bid_admin_exists = 0,
  'ALTER TABLE users ADD COLUMN bid_restriction_admin_id BIGINT UNSIGNED NULL AFTER bid_restriction_started_at',
  'SELECT 1'
);
PREPARE add_user_bid_admin_stmt FROM @add_user_bid_admin_sql;
EXECUTE add_user_bid_admin_stmt;
DEALLOCATE PREPARE add_user_bid_admin_stmt;

SET @bids_asset_active_amount_index_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'bids'
    AND INDEX_NAME = 'idx_bids_asset_active_amount'
);

SET @add_bids_asset_active_amount_index_sql := IF(
  @bids_asset_active_amount_index_exists = 0,
  'ALTER TABLE bids ADD INDEX idx_bids_asset_active_amount (asset_id, revoked_at, amount_cents, created_at, id)',
  'SELECT 1'
);
PREPARE add_bids_asset_active_amount_index_stmt FROM @add_bids_asset_active_amount_index_sql;
EXECUTE add_bids_asset_active_amount_index_stmt;
DEALLOCATE PREPARE add_bids_asset_active_amount_index_stmt;
