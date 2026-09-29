-- ==============================================================================
-- NEXUS CODE PLAY — MARIADB INITIAL SCHEMA (001_initial_schema.sql)
-- Target Server: HP EliteDesk 800 G3 Mini (Ubuntu Server / CasaOS / Docker)
-- Database Engine: InnoDB | Character Set: utf8mb4 | Collation: utf8mb4_unicode_ci
-- ==============================================================================

CREATE DATABASE IF NOT EXISTS nexus_code_play
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE nexus_code_play;

-- -------------------------------------------------------------
-- 1. ROLES & RBAC
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS roles (
  id VARCHAR(30) PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE,
  description VARCHAR(255),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- -------------------------------------------------------------
-- 2. USERS
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(64) PRIMARY KEY,
  username VARCHAR(64) NOT NULL UNIQUE,
  email VARCHAR(191) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NULL,
  display_name VARCHAR(100) NOT NULL,
  avatar_url VARCHAR(500),
  bio TEXT,
  status VARCHAR(20) DEFAULT 'ACTIVE',
  github_url VARCHAR(255),
  website_url VARCHAR(255),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  last_login_at DATETIME NULL,
  INDEX idx_users_email (email),
  INDEX idx_users_username (username),
  INDEX idx_users_status (status)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS user_roles (
  user_id VARCHAR(64) NOT NULL,
  role_id VARCHAR(30) NOT NULL,
  PRIMARY KEY (user_id, role_id),
  CONSTRAINT fk_user_roles_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_user_roles_role FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS user_badges (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL,
  badge VARCHAR(100) NOT NULL,
  CONSTRAINT fk_user_badges_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- -------------------------------------------------------------
-- 3. TECHNOLOGIES
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS technologies (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  category VARCHAR(50) NOT NULL,
  icon VARCHAR(50),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- -------------------------------------------------------------
-- 4. PORTFOLIO / PROJECTS
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS projects (
  id VARCHAR(64) PRIMARY KEY,
  slug VARCHAR(100) NOT NULL UNIQUE,
  title VARCHAR(200) NOT NULL,
  short_description VARCHAR(500) NOT NULL,
  description TEXT NOT NULL,
  category VARCHAR(50) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'In Entwicklung',
  featured TINYINT(1) DEFAULT 0,
  github_url VARCHAR(255),
  live_url VARCHAR(255),
  demo_url VARCHAR(255),
  problem TEXT,
  solution TEXT,
  architecture TEXT,
  author_id VARCHAR(64) NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_projects_slug (slug),
  INDEX idx_projects_category (category),
  INDEX idx_projects_featured (featured),
  CONSTRAINT fk_projects_author FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS project_technologies (
  project_id VARCHAR(64) NOT NULL,
  technology_name VARCHAR(100) NOT NULL,
  PRIMARY KEY (project_id, technology_name),
  CONSTRAINT fk_proj_tech_proj FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS project_key_points (
  id INT AUTO_INCREMENT PRIMARY KEY,
  project_id VARCHAR(64) NOT NULL,
  point_text VARCHAR(500) NOT NULL,
  sort_order INT DEFAULT 0,
  CONSTRAINT fk_proj_points_proj FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS project_snippets (
  id INT AUTO_INCREMENT PRIMARY KEY,
  project_id VARCHAR(64) NOT NULL,
  title VARCHAR(150) NOT NULL,
  language VARCHAR(50) NOT NULL,
  code_content TEXT NOT NULL,
  CONSTRAINT fk_proj_snippets_proj FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- -------------------------------------------------------------
-- 5. PRODUCTS & STORE
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS product_categories (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  slug VARCHAR(100) NOT NULL UNIQUE,
  description VARCHAR(255)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS products (
  id VARCHAR(64) PRIMARY KEY,
  slug VARCHAR(100) NOT NULL UNIQUE,
  name VARCHAR(200) NOT NULL,
  short_description VARCHAR(500) NOT NULL,
  description TEXT NOT NULL,
  price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  currency VARCHAR(3) NOT NULL DEFAULT 'EUR',
  category_id VARCHAR(50) NOT NULL,
  digital_product TINYINT(1) DEFAULT 1,
  file_format VARCHAR(50) DEFAULT 'ZIP',
  file_size VARCHAR(50) DEFAULT '1.0 MB',
  version VARCHAR(30) DEFAULT '1.0.0',
  license VARCHAR(100) DEFAULT 'Single Developer Commercial',
  author_id VARCHAR(64) NOT NULL,
  stock INT DEFAULT 9999,
  featured TINYINT(1) DEFAULT 0,
  published TINYINT(1) DEFAULT 1,
  rating DECIMAL(3,2) DEFAULT 5.00,
  reviews_count INT DEFAULT 0,
  download_url VARCHAR(500),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_products_slug (slug),
  INDEX idx_products_category (category_id),
  INDEX idx_products_featured (featured),
  CONSTRAINT fk_products_author FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- -------------------------------------------------------------
-- 6. CARTS & ORDERS
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS carts (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) NULL,
  session_id VARCHAR(100) NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_carts_user (user_id),
  INDEX idx_carts_session (session_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS cart_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  cart_id VARCHAR(64) NOT NULL,
  product_id VARCHAR(64) NOT NULL,
  quantity INT NOT NULL DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_cart_items_cart FOREIGN KEY (cart_id) REFERENCES carts(id) ON DELETE CASCADE,
  CONSTRAINT fk_cart_items_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS orders (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL,
  customer_email VARCHAR(191) NOT NULL,
  total_amount DECIMAL(10,2) NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'EUR',
  status VARCHAR(20) NOT NULL DEFAULT 'COMPLETED',
  payment_status VARCHAR(20) NOT NULL DEFAULT 'PAID',
  download_token VARCHAR(100) NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_orders_user (user_id),
  INDEX idx_orders_token (download_token)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS order_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_id VARCHAR(64) NOT NULL,
  product_id VARCHAR(64) NOT NULL,
  product_name_snapshot VARCHAR(200) NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  quantity INT NOT NULL DEFAULT 1,
  file_format_snapshot VARCHAR(50) DEFAULT 'ZIP',
  CONSTRAINT fk_order_items_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- -------------------------------------------------------------
-- 7. COMMUNITY POSTS, COMMENTS, LIKES
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS posts (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL,
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  category VARCHAR(50) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'PUBLISHED',
  likes_count INT DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_posts_user (user_id),
  INDEX idx_posts_category (category),
  CONSTRAINT fk_posts_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS comments (
  id VARCHAR(64) PRIMARY KEY,
  post_id VARCHAR(64) NOT NULL,
  author_id VARCHAR(64) NOT NULL,
  author_name VARCHAR(100) NOT NULL,
  content TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_comments_post (post_id),
  CONSTRAINT fk_comments_post FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS tags (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS post_tags (
  post_id VARCHAR(64) NOT NULL,
  tag_name VARCHAR(50) NOT NULL,
  PRIMARY KEY (post_id, tag_name),
  CONSTRAINT fk_post_tags_post FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- -------------------------------------------------------------
-- 8. NOTIFICATIONS
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notifications (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL,
  title VARCHAR(200) NOT NULL,
  message TEXT NOT NULL,
  read_status TINYINT(1) DEFAULT 0,
  notification_type VARCHAR(50) DEFAULT 'SYSTEM',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_notif_user (user_id),
  INDEX idx_notif_read (read_status)
) ENGINE=InnoDB;

-- -------------------------------------------------------------
-- 9. AI CONVERSATIONS & MESSAGES (Persistent History)
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ai_conversations (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL,
  title VARCHAR(255) NOT NULL,
  role_id VARCHAR(50) NOT NULL DEFAULT 'general',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_ai_conv_user (user_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS ai_messages (
  id VARCHAR(64) PRIMARY KEY,
  conversation_id VARCHAR(64) NOT NULL,
  role VARCHAR(20) NOT NULL,
  content MEDIUMTEXT NOT NULL,
  model VARCHAR(50) DEFAULT 'gemini-3.5-flash',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_ai_msg_conv (conversation_id),
  CONSTRAINT fk_ai_messages_conv FOREIGN KEY (conversation_id) REFERENCES ai_conversations(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- -------------------------------------------------------------
-- 10. CALENDAR CONNECTIONS
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS calendar_connections (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL,
  provider VARCHAR(50) NOT NULL DEFAULT 'google',
  email VARCHAR(191) NOT NULL,
  sync_enabled TINYINT(1) DEFAULT 1,
  last_synced_at DATETIME NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_cal_conn_user (user_id)
) ENGINE=InnoDB;

-- -------------------------------------------------------------
-- 11. API ENDPOINT MONITORING & AUDIT LOGS
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS api_endpoints_log (
  id VARCHAR(64) PRIMARY KEY,
  endpoint VARCHAR(255) NOT NULL,
  service VARCHAR(50) NOT NULL,
  status_code INT NOT NULL,
  response_time_ms INT NOT NULL,
  status VARCHAR(20) NOT NULL,
  checked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_api_logs_service (service),
  INDEX idx_api_logs_checked (checked_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS audit_logs (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL,
  username VARCHAR(100) NOT NULL,
  action VARCHAR(100) NOT NULL,
  details TEXT NOT NULL,
  ip VARCHAR(45) NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_audit_user (user_id),
  INDEX idx_audit_action (action),
  INDEX idx_audit_date (created_at)
) ENGINE=InnoDB;
