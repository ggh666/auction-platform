INSERT INTO users (openid, display_name, avatar_url)
VALUES ('platform:asset-publisher', '平台代发', NULL)
ON DUPLICATE KEY UPDATE
  display_name = VALUES(display_name),
  updated_at = CURRENT_TIMESTAMP;

UPDATE auction_assets AS asset
JOIN users AS platform_user ON platform_user.openid = 'platform:asset-publisher'
SET
  asset.status = 'removed',
  asset.ended_at = COALESCE(asset.ended_at, CURRENT_TIMESTAMP),
  asset.updated_at = CURRENT_TIMESTAMP
WHERE asset.status IN ('draft', 'pending_review', 'active')
  AND asset.seller_id <> platform_user.id;
