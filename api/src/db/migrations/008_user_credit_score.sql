-- Add user credit score for publish eligibility and principal review deductions.

SET @credit_score_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'users'
    AND COLUMN_NAME = 'credit_score'
);

SET @add_credit_score_sql := IF(
  @credit_score_exists = 0,
  'ALTER TABLE users ADD COLUMN credit_score INT UNSIGNED NOT NULL DEFAULT 100 AFTER violation_count',
  'SELECT 1'
);
PREPARE add_credit_score_stmt FROM @add_credit_score_sql;
EXECUTE add_credit_score_stmt;
DEALLOCATE PREPARE add_credit_score_stmt;

SET @credit_reset_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'users'
    AND COLUMN_NAME = 'credit_reset_at'
);

SET @add_credit_reset_sql := IF(
  @credit_reset_exists = 0,
  'ALTER TABLE users ADD COLUMN credit_reset_at DATETIME NULL AFTER credit_score',
  'SELECT 1'
);
PREPARE add_credit_reset_stmt FROM @add_credit_reset_sql;
EXECUTE add_credit_reset_stmt;
DEALLOCATE PREPARE add_credit_reset_stmt;
