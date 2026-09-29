-- Additive Product CMS and media storage schema; existing records are preserved.
USE nexus_code_play;

ALTER TABLE media_files
  ADD COLUMN IF NOT EXISTS storage_key VARCHAR(128) NULL;

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS cover_media_id VARCHAR(64) NULL;

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS tags JSON NULL,
  ADD COLUMN IF NOT EXISTS features JSON NULL,
  ADD COLUMN IF NOT EXISTS requirements JSON NULL,
  ADD COLUMN IF NOT EXISTS changelog TEXT NULL,
  ADD COLUMN IF NOT EXISTS meta_title VARCHAR(255) NULL,
  ADD COLUMN IF NOT EXISTS meta_description VARCHAR(500) NULL,
  ADD COLUMN IF NOT EXISTS cover_media_id VARCHAR(64) NULL,
  ADD COLUMN IF NOT EXISTS download_media_id VARCHAR(64) NULL;

CREATE TABLE IF NOT EXISTS project_media (
  project_id VARCHAR(64) NOT NULL,
  media_id VARCHAR(64) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  PRIMARY KEY (project_id, media_id),
  UNIQUE KEY uq_project_media_order (project_id, sort_order),
  CONSTRAINT fk_project_media_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  CONSTRAINT fk_project_media_media FOREIGN KEY (media_id) REFERENCES media_files(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS product_media (
  product_id VARCHAR(64) NOT NULL,
  media_id VARCHAR(64) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  PRIMARY KEY (product_id, media_id),
  UNIQUE KEY uq_product_media_order (product_id, sort_order),
  CONSTRAINT fk_product_media_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  CONSTRAINT fk_product_media_media FOREIGN KEY (media_id) REFERENCES media_files(id) ON DELETE RESTRICT
) ENGINE=InnoDB;