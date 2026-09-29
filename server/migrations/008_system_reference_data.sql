-- Idempotent system reference data only. No users or content are seeded here.
USE nexus_code_play;

INSERT IGNORE INTO roles (id, name, description) VALUES
  ('GUEST', 'Guest', 'Unauthenticated visitor with read-only access'),
  ('USER', 'User', 'Standard developer community member'),
  ('CREATOR', 'Creator', 'Content publisher and project author'),
  ('MODERATOR', 'Moderator', 'Community and discussion moderator'),
  ('ADMIN', 'Administrator', 'Full system management and infrastructure control');

INSERT IGNORE INTO product_categories (id, name, slug, description) VALUES
  ('templates', 'Templates', 'templates', 'Developer templates and project starters'),
  ('dev-tools', 'Developer Tools', 'dev-tools', 'Developer tools and infrastructure utilities'),
  ('3d-stl', '3D Models & STL', '3d-stl', '3D models and printable assets'),
  ('tutorials', 'Tutorials', 'tutorials', 'Technical guides and learning resources');