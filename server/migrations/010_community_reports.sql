-- NEXUS CODE PLAY — COMMUNITY REPORTS & MODERATION (010_community_reports.sql)

CREATE TABLE IF NOT EXISTS community_reports (
  id VARCHAR(64) PRIMARY KEY,
  reporter_id VARCHAR(64) NOT NULL,
  post_id VARCHAR(64) NULL,
  comment_id VARCHAR(64) NULL,
  reason TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  reviewer_id VARCHAR(64) NULL,
  review_notes TEXT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  resolved_at DATETIME NULL,
  INDEX idx_reports_status (status),
  INDEX idx_reports_post (post_id),
  INDEX idx_reports_comment (comment_id),
  CONSTRAINT fk_reports_reporter FOREIGN KEY (reporter_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;
