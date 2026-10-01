-- Additive profile fields; existing users and role/session data are preserved.
USE nexus_code_play;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS skills JSON NULL,
  ADD COLUMN IF NOT EXISTS technologies JSON NULL;