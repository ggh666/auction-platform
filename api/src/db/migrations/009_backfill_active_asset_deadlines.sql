-- Backfill active assets that still carry the publish-time default deadline.
-- These rows came from older deployments before approval forced a 24-hour window.
UPDATE auction_assets
SET effective_end_at = DATE_ADD(COALESCE(reviewed_at, updated_at, created_at), INTERVAL 24 HOUR)
WHERE status = 'active'
  AND effective_end_at >= '2099-12-31 00:00:00'
  AND DATE_ADD(COALESCE(reviewed_at, updated_at, created_at), INTERVAL 24 HOUR) < effective_end_at;
