-- Remove buyer contact collection fields and reminder notification type.

DELETE FROM station_notifications WHERE type = 'deal_contact_required';

ALTER TABLE station_notifications
  MODIFY COLUMN type ENUM('outbid') NOT NULL;

SET @buyer_contact_game_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'deal_followups'
    AND COLUMN_NAME = 'buyer_contact_game_encrypted'
);

SET @drop_buyer_contact_game_sql := IF(
  @buyer_contact_game_exists = 1,
  'ALTER TABLE deal_followups DROP COLUMN buyer_contact_game_encrypted',
  'SELECT 1'
);
PREPARE drop_buyer_contact_game_stmt FROM @drop_buyer_contact_game_sql;
EXECUTE drop_buyer_contact_game_stmt;
DEALLOCATE PREPARE drop_buyer_contact_game_stmt;

SET @buyer_contact_wechat_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'deal_followups'
    AND COLUMN_NAME = 'buyer_contact_wechat_encrypted'
);

SET @drop_buyer_contact_wechat_sql := IF(
  @buyer_contact_wechat_exists = 1,
  'ALTER TABLE deal_followups DROP COLUMN buyer_contact_wechat_encrypted',
  'SELECT 1'
);
PREPARE drop_buyer_contact_wechat_stmt FROM @drop_buyer_contact_wechat_sql;
EXECUTE drop_buyer_contact_wechat_stmt;
DEALLOCATE PREPARE drop_buyer_contact_wechat_stmt;

SET @buyer_contact_note_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'deal_followups'
    AND COLUMN_NAME = 'buyer_contact_note_encrypted'
);

SET @drop_buyer_contact_note_sql := IF(
  @buyer_contact_note_exists = 1,
  'ALTER TABLE deal_followups DROP COLUMN buyer_contact_note_encrypted',
  'SELECT 1'
);
PREPARE drop_buyer_contact_note_stmt FROM @drop_buyer_contact_note_sql;
EXECUTE drop_buyer_contact_note_stmt;
DEALLOCATE PREPARE drop_buyer_contact_note_stmt;

SET @buyer_contact_submitted_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'deal_followups'
    AND COLUMN_NAME = 'buyer_contact_submitted_at'
);

SET @drop_buyer_contact_submitted_sql := IF(
  @buyer_contact_submitted_exists = 1,
  'ALTER TABLE deal_followups DROP COLUMN buyer_contact_submitted_at',
  'SELECT 1'
);
PREPARE drop_buyer_contact_submitted_stmt FROM @drop_buyer_contact_submitted_sql;
EXECUTE drop_buyer_contact_submitted_stmt;
DEALLOCATE PREPARE drop_buyer_contact_submitted_stmt;

SET @contact_notice_sent_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'deal_followups'
    AND COLUMN_NAME = 'contact_notice_sent_at'
);

SET @drop_contact_notice_sent_sql := IF(
  @contact_notice_sent_exists = 1,
  'ALTER TABLE deal_followups DROP COLUMN contact_notice_sent_at',
  'SELECT 1'
);
PREPARE drop_contact_notice_sent_stmt FROM @drop_contact_notice_sent_sql;
EXECUTE drop_contact_notice_sent_stmt;
DEALLOCATE PREPARE drop_contact_notice_sent_stmt;
