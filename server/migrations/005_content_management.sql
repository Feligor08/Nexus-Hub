-- ==============================================================================
-- NEXUS CODE PLAY — CONTENT MANAGEMENT SYSTEM SCHEMA (005_content_management.sql)
-- Adds Content Lifecycle (DRAFT, PUBLISHED, ARCHIVED), Media, Versions & Entitlements
-- ==============================================================================

USE nexus_code_play;

-- 1. Extend projects table with CMS lifecycle columns
ALTER TABLE projects 
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'DRAFT',
  ADD COLUMN IF NOT EXISTS visibility VARCHAR(20) DEFAULT 'PUBLIC',
  ADD COLUMN IF NOT EXISTS published_at DATETIME NULL,
  ADD COLUMN IF NOT EXISTS case_study_problem TEXT NULL,
  ADD COLUMN IF NOT EXISTS case_study_solution TEXT NULL,
  ADD COLUMN IF NOT EXISTS case_study_learnings TEXT NULL,
  ADD COLUMN IF NOT EXISTS documentation_url VARCHAR(255) NULL,
  ADD COLUMN IF NOT EXISTS video_url VARCHAR(255) NULL;

-- 2. Extend products table with CMS status and media association
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'DRAFT',
  ADD COLUMN IF NOT EXISTS visibility VARCHAR(20) DEFAULT 'PUBLIC',
  ADD COLUMN IF NOT EXISTS published_at DATETIME NULL,
  ADD COLUMN IF NOT EXISTS media_file_id VARCHAR(64) NULL,
  ADD COLUMN IF NOT EXISTS demo_file_url VARCHAR(255) NULL,
  ADD COLUMN IF NOT EXISTS documentation_url VARCHAR(255) NULL;

-- 3. Media Files Table for user uploads and digital assets
CREATE TABLE IF NOT EXISTS media_files (
  id VARCHAR(64) PRIMARY KEY,
  owner_id VARCHAR(64) NOT NULL,
  filename VARCHAR(255) NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  storage_path VARCHAR(500) NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  file_size INT NOT NULL,
  file_category VARCHAR(50) DEFAULT 'file',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_media_owner (owner_id),
  INDEX idx_media_category (file_category)
) ENGINE=InnoDB;

-- 4. Product Versions Table (v1.0.0, v1.1.0, etc.)
CREATE TABLE IF NOT EXISTS product_versions (
  id VARCHAR(64) PRIMARY KEY,
  product_id VARCHAR(64) NOT NULL,
  version VARCHAR(50) NOT NULL,
  release_notes TEXT,
  media_id VARCHAR(64) NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_pv_product (product_id),
  CONSTRAINT fk_pv_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 5. Digital Download Entitlements
CREATE TABLE IF NOT EXISTS download_entitlements (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL,
  product_id VARCHAR(64) NOT NULL,
  order_id VARCHAR(64) NOT NULL,
  version_id VARCHAR(64) NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_de_user (user_id),
  INDEX idx_de_product (product_id),
  INDEX idx_de_order (order_id)
) ENGINE=InnoDB;

-- 6. Time-limited, secure Download Tokens (hashed server-side)
CREATE TABLE IF NOT EXISTS download_tokens (
  id VARCHAR(64) PRIMARY KEY,
  entitlement_id VARCHAR(64) NOT NULL,
  user_id VARCHAR(64) NOT NULL,
  token_hash VARCHAR(128) NOT NULL UNIQUE,
  expires_at DATETIME NOT NULL,
  used_at DATETIME NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_dt_hash (token_hash),
  INDEX idx_dt_user (user_id),
  INDEX idx_dt_entitlement (entitlement_id)
) ENGINE=InnoDB;
