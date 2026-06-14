ALTER TABLE exchange_resources
  MODIFY status ENUM('pending_image_review','active','closed','removed','expired') NOT NULL DEFAULT 'pending_image_review',
  ADD COLUMN dragon_ball_amount_cents BIGINT NULL AFTER dragon_ball_attributes,
  ADD COLUMN image_object_key VARCHAR(512) NOT NULL DEFAULT '' AFTER title,
  ADD COLUMN image_url VARCHAR(1024) NOT NULL DEFAULT '' AFTER image_object_key,
  ADD COLUMN image_mime_type VARCHAR(80) NOT NULL DEFAULT 'image/jpeg' AFTER image_url,
  ADD COLUMN image_size_bytes BIGINT NOT NULL DEFAULT 0 AFTER image_mime_type,
  ADD COLUMN expires_at DATETIME NULL AFTER status;

UPDATE exchange_resources
SET expires_at = DATE_ADD(created_at, INTERVAL 30 DAY)
WHERE expires_at IS NULL;

ALTER TABLE exchange_resources
  MODIFY expires_at DATETIME NOT NULL,
  DROP INDEX idx_exchange_resources_public,
  DROP INDEX idx_exchange_resources_dragon,
  ADD INDEX idx_exchange_resources_public (status, game_name, expires_at, updated_at, id),
  ADD INDEX idx_exchange_resources_dragon (status, dragon_ball_profession, dragon_ball_quality, expires_at, updated_at),
  ADD INDEX idx_exchange_resources_expires (status, expires_at);
