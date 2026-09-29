-- ==============================================================================
-- NEXUS CODE PLAY — SPRINT 2: AUTH & SESSIONS (003_auth_sessions.sql)
-- Target Server: HP EliteDesk 800 G3 Mini (MariaDB 11 / CasaOS / Docker)
-- ==============================================================================

USE nexus_code_play;

-- 1. Create User Sessions table for server-side stateful session governance
CREATE TABLE IF NOT EXISTS user_sessions (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL,
  token_hash VARCHAR(128) NOT NULL UNIQUE,
  ip_address VARCHAR(45),
  user_agent VARCHAR(255),
  expires_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_sessions_user (user_id),
  INDEX idx_sessions_token (token_hash),
  INDEX idx_sessions_expires (expires_at),
  CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 2. Ensure users table has last_login_at and status index
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at DATETIME NULL;
