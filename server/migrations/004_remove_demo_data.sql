-- ==============================================================================
-- NEXUS CODE PLAY — PRODUCTION CLEANUP (004_remove_demo_data.sql)
-- Cleans out all hardcoded test data, fake accounts and demo projects/products.
-- Foundational structure (roles, technical tables) remains intact.
-- ==============================================================================

USE nexus_code_play;

-- 1. Remove demo comments, posts and tags
DELETE FROM comments;
DELETE FROM post_tags;
DELETE FROM posts;

-- 2. Remove demo order items and orders
DELETE FROM order_items;
DELETE FROM orders;

-- 3. Remove demo product assets and products
DELETE FROM product_downloads;
DELETE FROM product_images;
DELETE FROM products;

-- 4. Remove demo project technologies, snippets, keypoints and projects
DELETE FROM project_snippets;
DELETE FROM project_key_points;
DELETE FROM project_technologies;
DELETE FROM projects;

-- 5. Remove demo notifications and AI conversations
DELETE FROM ai_messages;
DELETE FROM ai_conversations;
DELETE FROM notifications;
DELETE FROM user_sessions;

-- 6. Remove demo seed accounts (feligor08 demo seed, it_apprentice demo seed)
DELETE FROM user_badges WHERE user_id IN ('usr-felix-schlueter', 'usr-ita-dev-guest');
DELETE FROM user_roles WHERE user_id IN ('usr-felix-schlueter', 'usr-ita-dev-guest');
DELETE FROM users WHERE id IN ('usr-felix-schlueter', 'usr-ita-dev-guest');

-- Ensure standard roles exist
INSERT IGNORE INTO roles (id, name, description) VALUES
  ('ADMIN', 'Administrator', 'Full system control, content governance and infrastructure monitoring'),
  ('CREATOR', 'Creator', 'Content creator, template publisher and project author'),
  ('MODERATOR', 'Moderator', 'Community discussion and post moderator'),
  ('USER', 'User', 'Standard platform member'),
  ('GUEST', 'Guest', 'Unauthenticated visitor with read-only access');
