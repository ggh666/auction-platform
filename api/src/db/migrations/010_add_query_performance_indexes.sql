-- Add indexes for high-volume list, count, dashboard, and profile queries.
-- These indexes target existing query shapes without changing table data.

ALTER TABLE auction_assets
  ADD INDEX idx_assets_active_end (status, effective_end_at, created_at, id),
  ADD INDEX idx_assets_public_filters (status, game_name, asset_type, effective_end_at, created_at, id),
  ADD INDEX idx_assets_status_created (status, created_at, id),
  ADD INDEX idx_assets_created (created_at, id),
  ADD INDEX idx_assets_principal_created (principal_id, created_at, id),
  ADD INDEX idx_assets_seller_updated (seller_id, updated_at, id),
  ADD INDEX idx_assets_highest_bidder_updated (highest_bidder_id, updated_at, id);

ALTER TABLE bids
  ADD INDEX idx_bids_created (created_at, id);

ALTER TABLE users
  ADD INDEX idx_users_created (created_at, id),
  ADD INDEX idx_users_banned_at (banned_at, id),
  ADD INDEX idx_users_credit_reset (credit_reset_at, credit_score, id);

ALTER TABLE reports
  ADD INDEX idx_reports_created (created_at, id);

ALTER TABLE violation_records
  ADD INDEX idx_violations_published (published_at, id),
  ADD INDEX idx_violations_report (report_id);
