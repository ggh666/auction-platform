INSERT INTO system_configs (config_key, config_value)
VALUES ('check_in_url', '-')
ON DUPLICATE KEY UPDATE config_key = config_key;
