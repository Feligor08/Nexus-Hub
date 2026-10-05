-- ==============================================================================
-- NEXUS CODE PLAY — PRODUCTION CLEANUP (004_remove_demo_data.sql)
-- Safely removes initial demo seed data by specific IDs without wiping real user records.
-- ==============================================================================

USE nexus_code_play;

-- 1. Remove specific demo comments & posts
DELETE FROM comments WHERE id IN ('comm-alex-tailscale');
DELETE FROM posts WHERE id IN ('post-elitedesk-tailscale', 'post-8051-timer-calculator');

-- 2. Remove specific demo products and their relationships
DELETE FROM product_downloads WHERE product_id IN ('prod-net10-wpf-mvvm', 'prod-homeserver-docker-blueprints', 'prod-elitedesk-gridfinity-stl', 'prod-8051-asm-compendium');
DELETE FROM product_images WHERE product_id IN ('prod-net10-wpf-mvvm', 'prod-homeserver-docker-blueprints', 'prod-elitedesk-gridfinity-stl', 'prod-8051-asm-compendium');
DELETE FROM products WHERE id IN ('prod-net10-wpf-mvvm', 'prod-homeserver-docker-blueprints', 'prod-elitedesk-gridfinity-stl', 'prod-8051-asm-compendium');

-- 3. Remove specific demo projects and their relationships
DELETE FROM project_snippets WHERE project_id IN ('proj-hp-elitedesk-homeserver', 'proj-wpf-csharp-management', 'proj-8051-microcontroller-lab');
DELETE FROM project_key_points WHERE project_id IN ('proj-hp-elitedesk-homeserver', 'proj-wpf-csharp-management', 'proj-8051-microcontroller-lab');
DELETE FROM project_technologies WHERE project_id IN ('proj-hp-elitedesk-homeserver', 'proj-wpf-csharp-management', 'proj-8051-microcontroller-lab');
DELETE FROM projects WHERE id IN ('proj-hp-elitedesk-homeserver', 'proj-wpf-csharp-management', 'proj-8051-microcontroller-lab');

-- 4. Remove demo user accounts
DELETE FROM user_badges WHERE user_id IN ('usr-felix-schlueter', 'usr-ita-dev-guest');
DELETE FROM user_roles WHERE user_id IN ('usr-felix-schlueter', 'usr-ita-dev-guest');
DELETE FROM users WHERE id IN ('usr-felix-schlueter', 'usr-ita-dev-guest');

-- 5. Ensure core roles exist
INSERT IGNORE INTO roles (id, name, description) VALUES
  ('ADMIN', 'Administrator', 'Full system control, content governance and infrastructure monitoring'),
  ('CREATOR', 'Creator', 'Content creator, template publisher and project author'),
  ('MODERATOR', 'Moderator', 'Community discussion and post moderator'),
  ('USER', 'User', 'Standard platform member'),
  ('GUEST', 'Guest', 'Unauthenticated visitor with read-only access');
