-- ==============================================================================
-- NEXUS CODE PLAY — SEED DATA (002_seed_initial_data.sql)
-- Seeds initial system roles, default users, projects, products & tech stack
-- ==============================================================================

USE nexus_code_play;

-- 1. Standard Roles
INSERT IGNORE INTO roles (id, name, description) VALUES
  ('GUEST', 'Guest', 'Unauthenticated visitor with read-only access'),
  ('USER', 'User', 'Standard developer community member'),
  ('CREATOR', 'Creator', 'Content publisher, template creator and project author'),
  ('MODERATOR', 'Moderator', 'Community and discussion moderator'),
  ('ADMIN', 'Administrator', 'Full system management and infrastructure control');

-- 2. Initial Primary User (Felix Schlüter / feligor08)
INSERT IGNORE INTO users (id, username, email, password_hash, display_name, avatar_url, bio, status, github_url, website_url) VALUES
  (
    'usr-felix-schlueter',
    'feligor08',
    'fschlueter08@gmail.com',
    '$2a$12$e68Y2kYtMhFhBqL/dK1r9.h6g92iB95w7.d0V5d.h5l619a928e16', -- default hash placeholder
    'Felix Schlüter',
    '/src/assets/images/avatar_ita_developer_1790662143237.jpg',
    'Auszubildender zum Informationstechnischen Assistenten (ITA, 2. Ausbildungsjahr). Ziel: Fachhochschulreife 2027 & Duales Studium Wirtschaftsinformatik bei der Atruvia AG.',
    'ACTIVE',
    'https://github.com/feligor08',
    'https://nexuscodeplay.dev'
  ),
  (
    'usr-ita-dev-guest',
    'it_apprentice',
    'apprentice@school.edu',
    '$2a$12$e68Y2kYtMhFhBqL/dK1r9.h6g92iB95w7.d0V5d.h5l619a928e16',
    'Alex M.',
    '/src/assets/images/avatar_ita_developer_1790662143237.jpg',
    'ITA-Mitschüler, Hardware-Bastler und 8051 Assembler Enthusiast.',
    'ACTIVE',
    'https://github.com',
    NULL
  );

-- User Roles
INSERT IGNORE INTO user_roles (user_id, role_id) VALUES
  ('usr-felix-schlueter', 'ADMIN'),
  ('usr-felix-schlueter', 'CREATOR'),
  ('usr-ita-dev-guest', 'USER');

-- User Badges
INSERT IGNORE INTO user_badges (user_id, badge) VALUES
  ('usr-felix-schlueter', 'ITA Auszubildender (2. Jahr)'),
  ('usr-felix-schlueter', 'Atruvia Dual Candidate 2027'),
  ('usr-felix-schlueter', 'Home-Server Admin'),
  ('usr-felix-schlueter', 'C# / .NET 10 Architect'),
  ('usr-felix-schlueter', 'Fabric Modder');

-- 3. Product Categories
INSERT IGNORE INTO product_categories (id, name, slug, description) VALUES
  ('templates', 'Templates', 'templates', 'C# .NET 10 & WPF Architektur-Vorlagen'),
  ('dev-tools', 'Developer Tools', 'dev-tools', 'Docker Compose & HomeServer Toolkits'),
  ('3d-stl', '3D Models & STL', '3d-stl', 'Bambu Lab & HP EliteDesk Mini Zubehör'),
  ('tutorials', 'Tutorials', 'tutorials', 'ITA Prüfungskompendien & 8051 Guides');

-- 4. Initial Projects
INSERT IGNORE INTO projects (id, slug, title, short_description, description, category, status, featured, github_url, live_url, author_id, problem, solution, architecture) VALUES
  (
    'proj-hp-elitedesk-homeserver',
    'hp-elitedesk-homeserver',
    'HP EliteDesk 800 G3 Mini Server Stack',
    'Persistente Home-Server Infrastruktur auf Ubuntu 24.04 LTS mit Docker, MariaDB, Nginx Proxy Manager und Tailscale Mesh-VPN.',
    'Das zentrale Herzstück meiner Heim-Infrastruktur. Ausgelegt auf 24/7 Betrieb, minimale Leistungsaufnahme (ca. 12W Idle) und langlebige Stabilität.',
    'DevOps',
    'Aktiv',
    1,
    'https://github.com/feligor08/hp-elitedesk-homeserver',
    'https://nexuscodeplay.dev',
    'usr-felix-schlueter',
    'Benötigt wurde eine stromsparende, leise und dennoch erweiterbare Plattform für Datenbanken, Web-Dienste und Cloud-Speicher.',
    'Einsatz eines HP EliteDesk 800 G3 Mini mit Intel Core i5 und NVMe-SSD, virtualisiert mit isolierten Docker-Containern und sicherem Fernzugriff über Tailscale.',
    'Docker Compose basierte Microservice-Topologie mit internem Bridge-Netzwerk und Tailscale Zero-Trust VPN.'
  ),
  (
    'proj-csharp-wpf-management-suite',
    'csharp-wpf-management-suite',
    'C# .NET 10 WPF Management Suite',
    'Moderne Desktop-Anwendung nach MVVM-Pattern mit Dependency Injection, CommunityToolkit.Mvvm und MariaDB Backend.',
    'Industrienahe Desktop-Applikation zur Verwaltung von Projekten, Server-Status und ITA-Schulaufgaben.',
    'Software',
    'In Entwicklung',
    1,
    'https://github.com/feligor08/nexus-wpf-management-suite',
    'https://nexuscodeplay.dev',
    'usr-felix-schlueter',
    'WPF-Anwendungen in Schulbeispielen leiden oft an unsauberem Code-Behind und blockierenden UI-Threads.',
    'Strikte Implementierung von MVVM, asynchronen RelayCommands und Microsoft.Extensions.DependencyInjection.',
    'Schichtenarchitektur: Presentation (WPF XAML) -> ViewModel (RelayCommands) -> Service Layer -> Repository (MariaDB / Dapper).'
  ),
  (
    'proj-8051-microcontroller-lab',
    '8051-microcontroller-lab',
    '8051 Mikrocontroller Assembler Labor-Suite',
    'Umfassende Sammlung getesteter 8051 Assembler-Routinen für Timer, 7-Segment-Anzeigen und serielle Schnittstellen.',
    'Entwickelt im Rahmen des hardwarenahen Unterrichts im 2. Ausbildungsjahr des Informationstechnischen Assistenten.',
    'ITA Curriculum',
    'Aktiv',
    1,
    'https://github.com/feligor08/8051-asm-lab',
    'https://nexuscodeplay.dev',
    'usr-felix-schlueter',
    'Präzise Zeitverzögerungen und Interrupt-Handhabung auf 12 MHz 8051 Systemen erfordern exakte mathematische Taktberechnungen.',
    'Entwicklung von standardisierten Makros, Interrupt Service Routinen und automatisierter Dokumentation.',
    'Hardwarenahe Register-Architektur mit sauberer Nutzung von TMOD, TH0, TL0 und PSW Registerbänken.'
  );

-- Project Technologies
INSERT IGNORE INTO project_technologies (project_id, technology_name) VALUES
  ('proj-hp-elitedesk-homeserver', 'Ubuntu Server 24.04'),
  ('proj-hp-elitedesk-homeserver', 'Docker & Compose'),
  ('proj-hp-elitedesk-homeserver', 'MariaDB 11'),
  ('proj-hp-elitedesk-homeserver', 'Tailscale VPN'),
  ('proj-hp-elitedesk-homeserver', 'Nginx Proxy Manager'),
  ('proj-csharp-wpf-management-suite', 'C# 13'),
  ('proj-csharp-wpf-management-suite', '.NET 10.0'),
  ('proj-csharp-wpf-management-suite', 'WPF (MVVM)'),
  ('proj-csharp-wpf-management-suite', 'CommunityToolkit.Mvvm'),
  ('proj-csharp-wpf-management-suite', 'MariaDB'),
  ('proj-8051-microcontroller-lab', '8051 Assembler'),
  ('proj-8051-microcontroller-lab', 'Keil µVision'),
  ('proj-8051-microcontroller-lab', 'Hardware Timer');
