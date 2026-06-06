INSERT INTO system_configs (config_key, config_value)
VALUES ('user_asset_publish_enabled', 'true')
ON DUPLICATE KEY UPDATE config_value = config_value;
