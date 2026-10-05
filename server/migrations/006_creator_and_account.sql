-- ==============================================================================
-- NEXUS CODE PLAY — SPRINT 6 CREATOR APPLICATIONS & PROFILE EXPANSIONS (006_creator_and_account.sql)
-- Adds Creator Application Workflow and Account Profile fields (location, website)
-- ==============================================================================

USE nexus_code_play;

-- 1. Add location and website fields to users table if not existing
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS location VARCHAR(150) NULL,
  ADD COLUMN IF NOT EXISTS website VARCHAR(255) NULL;

-- 2. Creator Applications Table
CREATE TABLE IF NOT EXISTS creator_applications (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL,
  portfolio_url VARCHAR(255) NULL,
  motivation TEXT NOT NULL,
  planned_projects TEXT NOT NULL,
  planned_content TEXT NOT NULL,
  status VARCHAR(20) DEFAULT 'PENDING',
  admin_notes TEXT NULL,
  reviewed_by VARCHAR(64) NULL,
  reviewed_at DATETIME NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_ca_user (user_id),
  INDEX idx_ca_status (status)
) ENGINE=InnoDB;
