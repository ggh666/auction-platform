CREATE TABLE IF NOT EXISTS content_safety_image_checks (
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
