SET @column_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'users'
    AND COLUMN_NAME = 'daily_publish_limit'
);

SET @ddl := IF(
  @column_exists = 0,
  'ALTER TABLE users ADD COLUMN daily_publish_limit INT UNSIGNED NULL AFTER violation_count',
  'SELECT 1'
);

PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

INSERT INTO system_configs (config_key, config_value)
VALUES ('default_daily_publish_limit', '3')
ON DUPLICATE KEY UPDATE config_value = config_value;
