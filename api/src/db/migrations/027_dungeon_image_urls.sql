INSERT INTO system_configs (config_key, config_value)
VALUES
  ('dungeon_material_image_url', '-'),
  ('dungeon_guide_image_url', '-')
ON DUPLICATE KEY UPDATE config_key = config_key;
