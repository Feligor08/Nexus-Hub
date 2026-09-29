-- Additive Project CMS fields; existing project content is preserved.
USE nexus_code_play;

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS case_study_goal TEXT NULL,
  ADD COLUMN IF NOT EXISTS case_study_result TEXT NULL;

CREATE TABLE IF NOT EXISTS project_gallery_images (
  project_id VARCHAR(64) NOT NULL,
  image_url VARCHAR(1000) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (project_id, sort_order),
  CONSTRAINT fk_project_gallery_project
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
) ENGINE=InnoDB;