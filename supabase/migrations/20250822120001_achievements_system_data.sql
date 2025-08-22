-- Achievements System Data
-- This migration populates the achievements table with all achievement definitions
-- Designed for 1-liter beer servings at German festivals

-- Consumption Achievements
INSERT INTO achievements (name, description, category, icon, points, rarity, conditions) VALUES
('First Drop', 'Record your first beer at the festival', 'consumption', 'first_beer', 10, 'common', '{"type": "threshold", "target_value": 1, "comparison_operator": "gte"}'),
('Beer Rookie', 'Reach 3 total beers', 'consumption', 'beer_mug', 25, 'common', '{"type": "threshold", "target_value": 3, "comparison_operator": "gte"}'),
('Halfway There', 'Reach 5 total beers in a festival', 'consumption', 'beer_mug', 40, 'common', '{"type": "threshold", "target_value": 5, "comparison_operator": "gte"}'),
('Serious Drinker', 'Reach 8 total beers', 'consumption', 'beer_bottle', 50, 'rare', '{"type": "threshold", "target_value": 8, "comparison_operator": "gte"}'),
('Double Digits', 'Reach 10 total beers in a festival', 'consumption', 'beer_bottle', 75, 'rare', '{"type": "threshold", "target_value": 10, "comparison_operator": "gte"}'),
('Beer Enthusiast', 'Reach 15 total beers', 'consumption', 'beer_cheers', 100, 'rare', '{"type": "threshold", "target_value": 15, "comparison_operator": "gte"}'),
('Marathon Drinker', 'Reach 20+ beers in a single festival', 'consumption', 'trophy', 150, 'epic', '{"type": "threshold", "target_value": 20, "comparison_operator": "gte"}'),
('Century Club', 'Reach 30 beers across all festivals', 'consumption', 'trophy', 250, 'epic', '{"type": "threshold", "target_value": 30, "comparison_operator": "gte"}'),
('Legend Status', 'Reach 50+ beers across all festivals', 'consumption', 'crown', 300, 'legendary', '{"type": "threshold", "target_value": 50, "comparison_operator": "gte"}'),
('Serious Session', 'Drink 3+ beers in a single day', 'consumption', 'fire', 35, 'common', '{"type": "threshold", "target_value": 3, "comparison_operator": "gte"}'),
('Daily Double', 'Drink 4+ beers in a single day', 'consumption', 'fire', 75, 'rare', '{"type": "threshold", "target_value": 4, "comparison_operator": "gte"}'),
('Power Hour', 'Drink 6+ beers in a single day', 'consumption', 'lightning', 150, 'epic', '{"type": "threshold", "target_value": 6, "comparison_operator": "gte"}');

-- Attendance Achievements  
INSERT INTO achievements (name, description, category, icon, points, rarity, conditions) VALUES
('Festival Newcomer', 'Attend your first day', 'attendance', 'wave', 10, 'common', '{"type": "threshold", "target_value": 1, "comparison_operator": "gte"}'),
('Regular', 'Attend 3 different days', 'attendance', 'calendar', 30, 'common', '{"type": "threshold", "target_value": 3, "comparison_operator": "gte"}'),
('Dedicated', 'Attend 5 different days', 'attendance', 'star', 75, 'rare', '{"type": "threshold", "target_value": 5, "comparison_operator": "gte"}'),
('Festival Warrior', 'Perfect attendance - attend all festival days', 'attendance', 'crown', 200, 'legendary', '{"type": "special", "comparison_operator": "eq"}'),
('Streak Master', 'Attend 3 consecutive days', 'attendance', 'flame', 100, 'epic', '{"type": "streak", "min_days": 3}'),
('Weekend Warrior', 'Attend all weekends during the festival', 'attendance', 'weekend', 150, 'epic', '{"type": "special"}'),
('Early Bird', 'Attend the first day of the festival', 'attendance', 'sunrise', 50, 'rare', '{"type": "special", "date_specific": "first_day"}');

-- Explorer Achievements
INSERT INTO achievements (name, description, category, icon, points, rarity, conditions) VALUES
('Tent Curious', 'Visit 3 different tents', 'explorer', 'tent', 25, 'common', '{"type": "variety", "target_value": 3}'),
('Tent Hopper', 'Visit 5 different tents', 'explorer', 'map', 50, 'rare', '{"type": "variety", "target_value": 5}'),
('Wiesn Wanderer', 'Visit all tent categories', 'explorer', 'compass', 100, 'epic', '{"type": "variety", "tent_categories": ["beer_tent", "wine_tent", "food_tent"]}'),
('Local Guide', 'Visit 10+ different tents', 'explorer', 'guide', 150, 'epic', '{"type": "variety", "target_value": 10}'),
('Tent Master', 'Visit 15+ different tents', 'explorer', 'master', 250, 'legendary', '{"type": "variety", "target_value": 15}');

-- Social Achievements
INSERT INTO achievements (name, description, category, icon, points, rarity, conditions) VALUES
('Team Player', 'Join your first group', 'social', 'handshake', 20, 'common', '{"type": "threshold", "target_value": 1, "comparison_operator": "gte"}'),
('Social Butterfly', 'Join 3+ groups', 'social', 'butterfly', 75, 'rare', '{"type": "threshold", "target_value": 3, "comparison_operator": "gte"}'),
('Group Leader', 'Create your first group', 'social', 'leader', 50, 'rare', '{"type": "threshold", "target_value": 1, "comparison_operator": "gte"}'),
('Group Champion', 'Win a group competition', 'social', 'medal', 100, 'epic', '{"type": "special"}'),
('Top Contributor', 'Finish in top 3 of a group', 'social', 'podium', 75, 'rare', '{"type": "special"}'),
('Photo Enthusiast', 'Upload 10+ photos', 'social', 'camera', 50, 'rare', '{"type": "threshold", "target_value": 10, "comparison_operator": "gte"}'),
('Memory Keeper', 'Upload 25+ photos', 'social', 'photo_album', 100, 'epic', '{"type": "threshold", "target_value": 25, "comparison_operator": "gte"}');

-- Competitive Achievements (removed 'Competitive Spirit' as requested)
INSERT INTO achievements (name, description, category, icon, points, rarity, conditions) VALUES
('Rising Star', 'Finish in top 5 of global leaderboard', 'competitive', 'rising_star', 150, 'epic', '{"type": "special"}'),
('Leaderboard Legend', 'Finish in top 3 of global leaderboard', 'competitive', 'legend', 300, 'legendary', '{"type": "special"}'),
('Multi-Group Champion', 'Win competitions in 2+ different groups', 'competitive', 'multi_trophy', 200, 'legendary', '{"type": "threshold", "target_value": 2, "comparison_operator": "gte"}');

-- Special Achievements
INSERT INTO achievements (name, description, category, icon, points, rarity, conditions) VALUES
('Festival Veteran', 'Participate in 2+ different festivals', 'special', 'veteran', 150, 'epic', '{"type": "threshold", "target_value": 2, "comparison_operator": "gte"}'),
('Multi-Year Champion', 'Win group competitions in 2+ festivals', 'special', 'multi_year', 300, 'legendary', '{"type": "threshold", "target_value": 2, "comparison_operator": "gte"}'),
('High Roller', 'Spend 500+ euros on beers in a single festival', 'special', 'money_bag', 200, 'epic', '{"type": "threshold", "target_value": 500, "comparison_operator": "gte"}'),
('Consistency King', 'Same beer count 3+ days in a row', 'special', 'consistency', 100, 'epic', '{"type": "special"}'),
('Photo Perfect', 'Upload at least one photo every day attended', 'special', 'perfect', 150, 'epic', '{"type": "special"}'),
('Opening Day Legend', 'Attend the very first day of your first festival', 'special', 'first_day', 100, 'rare', '{"type": "special", "date_specific": "opening_day"}'),
('Closing Time', 'Attend the last day of the festival', 'special', 'closing', 75, 'rare', '{"type": "special", "date_specific": "last_day"}');

-- Add comments about achievement counts
COMMENT ON TABLE achievements IS 'Core achievement definitions and metadata - Contains 38 achievements across 6 categories, designed for 1-liter beer servings';