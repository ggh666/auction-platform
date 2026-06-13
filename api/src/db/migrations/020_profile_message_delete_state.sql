ALTER TABLE asset_conversations
  ADD COLUMN user_deleted_at DATETIME NULL AFTER admin_read_at,
  ADD COLUMN target_user_deleted_at DATETIME NULL AFTER user_deleted_at;
