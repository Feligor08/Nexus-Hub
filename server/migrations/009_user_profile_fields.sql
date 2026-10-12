-- Additive profile fields; existing users and role/session data are preserved.

ALTER TABLE users ADD COLUMN IF NOT EXISTS skills JSON NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS technologies JSON NULL;