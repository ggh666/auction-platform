CREATE TABLE IF NOT EXISTS dragon_ball_price_reference_batches (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  game_name VARCHAR(80) NOT NULL,
  week_start_date DATE NOT NULL,
  week_end_date DATE NOT NULL,
  note VARCHAR(200) NOT NULL DEFAULT '',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_dragon_ball_price_reference_week (game_name, week_start_date),
  INDEX idx_dragon_ball_price_reference_latest (game_name, week_start_date, id)
);

CREATE TABLE IF NOT EXISTS dragon_ball_price_reference_items (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  batch_id BIGINT UNSIGNED NOT NULL,
  profession VARCHAR(20) NOT NULL,
  quality VARCHAR(20) NOT NULL,
  min_price_cents BIGINT UNSIGNED NOT NULL,
  max_price_cents BIGINT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_dragon_ball_price_reference_item (batch_id, profession, quality),
  INDEX idx_dragon_ball_price_reference_trend (profession, quality, batch_id),
  CONSTRAINT fk_dragon_ball_price_reference_batch FOREIGN KEY (batch_id) REFERENCES dragon_ball_price_reference_batches(id) ON DELETE CASCADE
);
