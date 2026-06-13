CREATE TABLE IF NOT EXISTS exchange_resources (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  publisher_id BIGINT UNSIGNED NOT NULL,
  game_name VARCHAR(80) NOT NULL,
  server_name VARCHAR(80) NOT NULL,
  title VARCHAR(120) NOT NULL,
  dragon_ball_element VARCHAR(10) NOT NULL,
  dragon_ball_profession VARCHAR(20) NOT NULL,
  dragon_ball_quality VARCHAR(20) NOT NULL,
  dragon_ball_attributes VARCHAR(200) NOT NULL,
  desired_exchange VARCHAR(200) NOT NULL,
  description VARCHAR(500) NOT NULL,
  status ENUM('active','closed','removed') NOT NULL DEFAULT 'active',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_exchange_resources_public (status, game_name, updated_at, id),
  INDEX idx_exchange_resources_dragon (status, dragon_ball_profession, dragon_ball_quality, updated_at),
  INDEX idx_exchange_resources_publisher (publisher_id, updated_at),
  CONSTRAINT fk_exchange_resources_publisher FOREIGN KEY (publisher_id) REFERENCES users(id)
);

INSERT INTO system_configs (config_key, config_value)
VALUES ('free_exchange_publish_enabled', 'true')
ON DUPLICATE KEY UPDATE config_value = config_value;

ALTER TABLE asset_conversations
  ADD COLUMN asset_source ENUM('auction_asset','exchange_resource') NOT NULL DEFAULT 'auction_asset' AFTER asset_id;

ALTER TABLE asset_conversations
  DROP FOREIGN KEY fk_asset_conversations_asset;

ALTER TABLE asset_conversations
  DROP INDEX uq_asset_conversation_principal,
  DROP INDEX uq_asset_conversation_seller,
  ADD UNIQUE KEY uq_asset_conversation_principal (asset_source, asset_id, conversation_type, user_id, principal_id),
  ADD UNIQUE KEY uq_asset_conversation_seller (asset_source, asset_id, conversation_type, user_id, target_user_id);
