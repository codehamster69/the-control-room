-- Seed items for The Control Room gacha game
-- Run this in Supabase SQL Editor
-- New rarities: Mythic, Legendary, Epic, Rare, Uncommon, Common

-- MYTHIC ITEMS (1% drop rate) - Power: 500
INSERT INTO items (name, rarity, score_value, image_url) VALUES
('Divine Blade', 'Mythic', 500, 'https://placehold.co/100x100/1a1a2e/ff0080?text=🗡️'),
('Celestial Crown', 'Mythic', 500, 'https://placehold.co/100x100/1a1a2e/ff0080?text=👑'),
('Eternal Flame', 'Mythic', 500, 'https://placehold.co/100x100/1a1a2e/ff0080?text=🔥'),
('Void Walker', 'Mythic', 500, 'https://placehold.co/100x100/1a1a2e/ff0080?text=🌑'),
('Soul Reaper', 'Mythic', 500, 'https://placehold.co/100x100/1a1a2e/ff0080?text=💀');

-- LEGENDARY ITEMS (3% drop rate) - Power: 200
INSERT INTO items (name, rarity, score_value, image_url) VALUES
('Dragon Slayer', 'Legendary', 200, 'https://placehold.co/100x100/1a1a2e/ffff00?text=🗡️'),
('Phoenix Wings', 'Legendary', 200, 'https://placehold.co/100x100/1a1a2e/ffff00?text=🪶'),
('Thunder God Hammer', 'Legendary', 200, 'https://placehold.co/100x100/1a1a2e/ffff00?text=🔨'),
('Shadow Assassin', 'Legendary', 200, 'https://placehold.co/100x100/1a1a2e/ffff00?text=🗡️'),
('Ice Dragon Heart', 'Legendary', 200, 'https://placehold.co/100x100/1a1a2e/ffff00?text=❤️');

-- EPIC ITEMS (7% drop rate) - Power: 100
INSERT INTO items (name, rarity, score_value, image_url) VALUES
('Enchanted Bow', 'Epic', 100, 'https://placehold.co/100x100/1a1a2e/a855f7?text=🏹'),
('Mage Staff', 'Epic', 100, 'https://placehold.co/100x100/1a1a2e/a855f7?text=🦯'),
('Knight Shield', 'Epic', 100, 'https://placehold.co/100x100/1a1a2e/a855f7?text=🛡️'),
('Berserker Axe', 'Epic', 100, 'https://placehold.co/100x100/1a1a2e/a855f7?text=🪓'),
('Healing Rod', 'Epic', 100, 'https://placehold.co/100x100/1a1a2e/a855f7?text=🪄'),
('Spirit Amulet', 'Epic', 100, 'https://placehold.co/100x100/1a1a2e/a855f7?text=📿'),
('Demon Horns', 'Epic', 100, 'https://placehold.co/100x100/1a1a2e/a855f7?text=🦌');

-- RARE ITEMS (15% drop rate) - Power: 50
INSERT INTO items (name, rarity, score_value, image_url) VALUES
('Steel Dagger', 'Rare', 50, 'https://placehold.co/100x100/1a1a2e/00ffff?text=🗡️'),
('Iron Sword', 'Rare', 50, 'https://placehold.co/100x100/1a1a2e/00ffff?text=⚔️'),
('Elven Bow', 'Rare', 50, 'https://placehold.co/100x100/1a1a2e/00ffff?text=🏹'),
('Magic Potion', 'Rare', 50, 'https://placehold.co/100x100/1a1a2e/00ffff?text=🧪'),
('Crystal Orb', 'Rare', 50, 'https://placehold.co/100x100/1a1a2e/00ffff?text=🔮'),
('Wind Boots', 'Rare', 50, 'https://placehold.co/100x100/1a1a2e/00ffff?text=👢'),
('Thunder Ring', 'Rare', 50, 'https://placehold.co/100x100/1a1a2e/00ffff?text=💍'),
('Fire Scroll', 'Rare', 50, 'https://placehold.co/100x100/1a1a2e/00ffff?text=📜');

-- UNCOMMON ITEMS (25% drop rate) - Power: 25
INSERT INTO items (name, rarity, score_value, image_url) VALUES
('Leather Armor', 'Uncommon', 25, 'https://placehold.co/100x100/1a1a2e/22c55e?text=👕'),
('Iron Helmet', 'Uncommon', 25, 'https://placehold.co/100x100/1a1a2e/22c55e?text=⛑️'),
('Wooden Shield', 'Uncommon', 25, 'https://placehold.co/100x100/1a1a2e/22c55e?text=🛡️'),
('Copper Ring', 'Uncommon', 25, 'https://placehold.co/100x100/1a1a2e/22c55e?text=💍'),
('Torch', 'Uncommon', 25, 'https://placehold.co/100x100/1a1a2e/22c55e?text=🔦'),
('Rope', 'Uncommon', 25, 'https://placehold.co/100x100/1a1a2e/22c55e?text=🪢'),
('Herb Bundle', 'Uncommon', 25, 'https://placehold.co/100x100/1a1a2e/22c55e?text=🌿'),
('Antidote', 'Uncommon', 25, 'https://placehold.co/100x100/1a1a2e/22c55e?text=💊');

-- COMMON ITEMS (49% drop rate) - Power: 10
INSERT INTO items (name, rarity, score_value, image_url) VALUES
('Wooden Sword', 'Common', 10, 'https://placehold.co/100x100/1a1a2e/9ca3af?text=🗡️'),
('Rusty Knife', 'Common', 10, 'https://placehold.co/100x100/1a1a2e/9ca3af?text=🔪'),
('Old Boot', 'Common', 10, 'https://placehold.co/100x100/1a1a2e/9ca3af?text=👢'),
('Stone', 'Common', 10, 'https://placehold.co/100x100/1a1a2e/9ca3af?text=🪨'),
('Stick', 'Common', 10, 'https://placehold.co/100x100/1a1a2e/9ca3af?text=🪵'),
('Feather', 'Common', 10, 'https://placehold.co/100x100/1a1a2e/9ca3af?text=🪶'),
('Bone', 'Common', 10, 'https://placehold.co/100x100/1a1a2e/9ca3af?text=🦴'),
('Mushroom', 'Common', 10, 'https://placehold.co/100x100/1a1a2e/9ca3af?text=🍄'),
('Apple', 'Common', 10, 'https://placehold.co/100x100/1a1a2e/9ca3af?text=🍎'),
('Bread', 'Common', 10, 'https://placehold.co/100x100/1a1a2e/9ca3af?text=🍞'),
('Water Flask', 'Common', 10, 'https://placehold.co/100x100/1a1a2e/9ca3af?text=💧'),
('Map Scraps', 'Common', 10, 'https://placehold.co/100x100/1a1a2e/9ca3af?text=🗺️');

-- Verify insertion
SELECT rarity, COUNT(*) as count, SUM(score_value) as total_power
FROM items
GROUP BY rarity
ORDER BY 
  CASE rarity 
    WHEN 'Mythic' THEN 1 
    WHEN 'Legendary' THEN 2 
    WHEN 'Epic' THEN 3 
    WHEN 'Rare' THEN 4 
    WHEN 'Uncommon' THEN 5 
    WHEN 'Common' THEN 6 
  END;

