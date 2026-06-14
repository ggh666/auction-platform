INSERT INTO dragon_ball_price_reference_batches (game_name, week_start_date, week_end_date, note)
VALUES ('塔防精灵', '2026-06-01', '2026-06-06', '6月1日-6日龙珠品类成交价区间统计')
ON DUPLICATE KEY UPDATE
  week_end_date = VALUES(week_end_date),
  note = VALUES(note),
  updated_at = CURRENT_TIMESTAMP,
  id = LAST_INSERT_ID(id);

SET @dragon_ball_price_reference_batch_id = LAST_INSERT_ID();

DELETE FROM dragon_ball_price_reference_items
WHERE batch_id = @dragon_ball_price_reference_batch_id;

INSERT INTO dragon_ball_price_reference_items
  (batch_id, profession, quality, min_price_cents, max_price_cents)
VALUES
  (@dragon_ball_price_reference_batch_id, '牧师', '红', 152000, 640000), -- 红色牧师
  (@dragon_ball_price_reference_batch_id, '熊猫', '红', 255000, 405000), -- 红色熊猫
  (@dragon_ball_price_reference_batch_id, '战士', '红', 132000, 750000), -- 红色战士
  (@dragon_ball_price_reference_batch_id, '工程', '红', 205000, 205000), -- 红色工程
  (@dragon_ball_price_reference_batch_id, '猎人', '红', 140000, 282000), -- 红色猎人
  (@dragon_ball_price_reference_batch_id, '法师', '红', 105000, 345000), -- 红色法师
  (@dragon_ball_price_reference_batch_id, '术士', '红', 93000, 390000), -- 红色术士
  (@dragon_ball_price_reference_batch_id, '召唤', '红', 120000, 200000), -- 红色召唤
  (@dragon_ball_price_reference_batch_id, '熊猫', '金', 72000, 199000), -- 金色熊猫
  (@dragon_ball_price_reference_batch_id, '牧师', '金', 71000, 148000), -- 金色牧师
  (@dragon_ball_price_reference_batch_id, '战士', '金', 52000, 135000), -- 金色战士
  (@dragon_ball_price_reference_batch_id, '工程', '金', 45000, 111100), -- 金色工程
  (@dragon_ball_price_reference_batch_id, '猎人', '金', 49000, 79000), -- 金色猎人
  (@dragon_ball_price_reference_batch_id, '术士', '金', 42000, 77000), -- 金色术士
  (@dragon_ball_price_reference_batch_id, '法师', '金', 33000, 82000), -- 金色法师
  (@dragon_ball_price_reference_batch_id, '召唤', '金', 37000, 60000), -- 金色召唤
  (@dragon_ball_price_reference_batch_id, '熊猫', '紫', 24000, 61000), -- 紫色熊猫
  (@dragon_ball_price_reference_batch_id, '牧师', '紫', 23000, 40500), -- 紫色牧师
  (@dragon_ball_price_reference_batch_id, '战士', '紫', 19000, 40000), -- 紫色战士
  (@dragon_ball_price_reference_batch_id, '工程', '紫', 13500, 40000), -- 紫色工程
  (@dragon_ball_price_reference_batch_id, '猎人', '紫', 11600, 30000), -- 紫色猎人
  (@dragon_ball_price_reference_batch_id, '法师', '紫', 8000, 32000), -- 紫色法师
  (@dragon_ball_price_reference_batch_id, '召唤', '紫', 8000, 24500), -- 紫色召唤
  (@dragon_ball_price_reference_batch_id, '术士', '紫', 10000, 31000), -- 紫色术士
  (@dragon_ball_price_reference_batch_id, '熊猫', '蓝', 5800, 8000), -- 蓝色熊猫
  (@dragon_ball_price_reference_batch_id, '工程', '蓝', 5000, 9000), -- 蓝色工程
  (@dragon_ball_price_reference_batch_id, '战士', '蓝', 5000, 5000), -- 蓝色战士
  (@dragon_ball_price_reference_batch_id, '召唤', '蓝', 3000, 5000), -- 蓝色召唤
  (@dragon_ball_price_reference_batch_id, '法师', '蓝', 2000, 5000), -- 蓝色法师
  (@dragon_ball_price_reference_batch_id, '猎人', '绿', 1000, 1000); -- 绿色猎人
