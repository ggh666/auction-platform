-- Add a covering index for public prop-list filters by principal and Dragon Ball metadata.

ALTER TABLE auction_assets
  ADD INDEX idx_assets_public_dragon_filters (
    status,
    game_name,
    asset_type,
    principal_id,
    dragon_ball_profession,
    dragon_ball_quality,
    effective_end_at,
    created_at,
    id
  );
