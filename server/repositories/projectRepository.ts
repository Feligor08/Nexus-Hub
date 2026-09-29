import { executeQuery, getLastDatabaseStatus } from '../config/database';
import { Project, ContentStatus } from '../models/types';
import { db } from '../db';

export class ProjectRepository {
  async findAll(options?: {
    category?: string;
    search?: string;
    featured?: boolean;
    status?: ContentStatus | string;
    visibility?: 'PUBLIC' | 'PRIVATE';
    authorId?: string;
    includeDrafts?: boolean;
    page?: number;
    limit?: number;
  }): Promise<{ projects: Project[]; total: number }> {
    const dbStatus = getLastDatabaseStatus();

    // Default public filtering: only PUBLISHED and PUBLIC unless explicitly requested with authorId or includeDrafts
    const targetStatus = options?.status || (options?.includeDrafts ? undefined : 'PUBLISHED');
    const targetVisibility = options?.visibility || (options?.includeDrafts ? undefined : 'PUBLIC');

    if (dbStatus.connected) {
      try {
        let sql = `SELECT * FROM projects WHERE 1=1`;
        const params: any[] = [];

        if (targetStatus && targetStatus !== 'all') {
          sql += ` AND status = ?`;
          params.push(targetStatus);
        }

        if (targetVisibility) {
          sql += ` AND (visibility = ? OR visibility IS NULL)`;
          params.push(targetVisibility);
        }

        if (options?.authorId) {
          sql += ` AND author_id = ?`;
          params.push(options.authorId);
        }

        if (options?.category && options.category !== 'all') {
          sql += ` AND category = ?`;
          params.push(options.category);
        }

        if (options?.featured !== undefined) {
          sql += ` AND featured = ?`;
          params.push(options.featured ? 1 : 0);
        }

        if (options?.search) {
          sql += ` AND (title LIKE ? OR short_description LIKE ?)`;
          const term = `%${options.search}%`;
          params.push(term, term);
        }

        sql += ` ORDER BY created_at DESC`;

        const limit = Math.min(options?.limit || 20, 100);
        const offset = ((options?.page || 1) - 1) * limit;
        sql += ` LIMIT ? OFFSET ?`;
        params.push(limit, offset);

        const rows = await executeQuery<any>(sql, params);

        const projects: Project[] = await Promise.all(
          rows.map(async (r) => {
            const techRows = await executeQuery<any>(
              `SELECT technology_name FROM project_technologies WHERE project_id = ?`,
              [r.id]
            );
            return {
              id: r.id,
              slug: r.slug,
              title: r.title,
              shortDesc: r.short_description || '',
              description: r.description || '',
              category: r.category || 'Software',
              techStack: techRows.map((t) => t.technology_name),
              coverImage: r.cover_image,
              galleryImages: [],
              githubUrl: r.github_url,
              liveUrl: r.live_url,
              demoUrl: r.demo_url,
              documentationUrl: r.documentation_url,
              videoUrl: r.video_url,
              status: r.status || 'PUBLISHED',
              visibility: r.visibility || 'PUBLIC',
              problem: r.case_study_problem || r.problem || '',
              solution: r.case_study_solution || r.solution || '',
              architecture: r.architecture || '',
              caseStudyProblem: r.case_study_problem || '',
              caseStudySolution: r.case_study_solution || '',
              caseStudyLearnings: r.case_study_learnings || '',
              keyFeatures: [],
              authorId: r.author_id,
              featured: Boolean(r.featured),
              publishedAt: r.published_at,
              createdAt: r.created_at,
              updatedAt: r.updated_at,
            };
          })
        );

        return { projects, total: projects.length };
      } catch (err) {
        console.warn('MariaDB query failed in projectRepository:', err);
      }
    }

    // Clean in-memory store
    let list = [...db.projects];

    if (targetStatus && targetStatus !== 'all') {
      list = list.filter((p) => (p.status || 'PUBLISHED') === targetStatus);
    }
    if (targetVisibility) {
      list = list.filter((p) => (p.visibility || 'PUBLIC') === targetVisibility);
    }
    if (options?.authorId) {
      list = list.filter((p) => p.authorId === options.authorId);
    }
    if (options?.category && options.category !== 'all') {
      list = list.filter((p) => p.category === options.category);
    }
    if (options?.featured !== undefined) {
      list = list.filter((p) => p.featured === options.featured);
    }
    if (options?.search) {
      const s = options.search.toLowerCase();
      list = list.filter(
        (p) =>
          p.title.toLowerCase().includes(s) ||
          p.shortDesc.toLowerCase().includes(s) ||
          p.techStack.some((t) => t.toLowerCase().includes(s))
      );
    }

    const total = list.length;
    const limit = options?.limit || 20;
    const page = options?.page || 1;
    const paginated = list.slice((page - 1) * limit, page * limit);

    return { projects: paginated, total };
  }

  async findBySlug(slug: string): Promise<Project | null> {
    const dbStatus = getLastDatabaseStatus();
    if (dbStatus.connected) {
      try {
        const rows = await executeQuery<any>(`SELECT * FROM projects WHERE slug = ? LIMIT 1`, [slug]);
        if (rows.length > 0) {
          const r = rows[0];
          const techRows = await executeQuery<any>(
            `SELECT technology_name FROM project_technologies WHERE project_id = ?`,
            [r.id]
          );
          return {
            id: r.id,
            slug: r.slug,
            title: r.title,
            shortDesc: r.short_description || '',
            description: r.description || '',
            category: r.category || 'Software',
            techStack: techRows.map((t) => t.technology_name),
            coverImage: r.cover_image,
            galleryImages: [],
            githubUrl: r.github_url,
            liveUrl: r.live_url,
            demoUrl: r.demo_url,
            documentationUrl: r.documentation_url,
            videoUrl: r.video_url,
            status: r.status || 'PUBLISHED',
            visibility: r.visibility || 'PUBLIC',
            problem: r.case_study_problem || r.problem || '',
            solution: r.case_study_solution || r.solution || '',
            architecture: r.architecture || '',
            caseStudyProblem: r.case_study_problem || '',
            caseStudySolution: r.case_study_solution || '',
            caseStudyLearnings: r.case_study_learnings || '',
            keyFeatures: [],
            authorId: r.author_id,
            featured: Boolean(r.featured),
            publishedAt: r.published_at,
            createdAt: r.created_at,
            updatedAt: r.updated_at,
          };
        }
      } catch (err) {
        console.warn('MariaDB query failed in projectRepository.findBySlug:', err);
      }
    }

    return db.projects.find((p) => p.slug === slug) || null;
  }

  async findById(id: string): Promise<Project | null> {
    const dbStatus = getLastDatabaseStatus();
    if (dbStatus.connected) {
      try {
        const rows = await executeQuery<any>(`SELECT slug FROM projects WHERE id = ? LIMIT 1`, [id]);
        if (rows.length > 0) {
          return this.findBySlug(rows[0].slug);
        }
      } catch (err) {
        console.warn('MariaDB query failed in projectRepository.findById:', err);
      }
    }
    return db.projects.find((p) => p.id === id) || null;
  }

  async create(data: Partial<Project>): Promise<Project> {
    const id = data.id || `proj-${Date.now()}`;
    const slug = data.slug || (data.title ? data.title.toLowerCase().replace(/[^a-z0-9]+/g, '-') : id);
    const now = new Date().toISOString();
    const status = data.status || 'DRAFT';
    const publishedAt = status === 'PUBLISHED' ? now : undefined;

    const newProj: Project = {
      id,
      slug,
      title: data.title || 'Neues Projekt',
      shortDesc: data.shortDesc || '',
      description: data.description || '',
      category: data.category || 'Software',
      techStack: data.techStack || [],
      coverImage: data.coverImage,
      galleryImages: data.galleryImages || [],
      githubUrl: data.githubUrl,
      liveUrl: data.liveUrl,
      demoUrl: data.demoUrl,
      documentationUrl: data.documentationUrl,
      videoUrl: data.videoUrl,
      status,
      visibility: data.visibility || 'PUBLIC',
      problem: data.problem || data.caseStudyProblem || '',
      solution: data.solution || data.caseStudySolution || '',
      architecture: data.architecture || '',
      caseStudyProblem: data.caseStudyProblem || data.problem || '',
      caseStudySolution: data.caseStudySolution || data.solution || '',
      caseStudyLearnings: data.caseStudyLearnings || '',
      keyFeatures: data.keyFeatures || [],
      authorId: data.authorId || 'anonymous',
      featured: Boolean(data.featured),
      publishedAt,
      createdAt: now,
      updatedAt: now,
    };

    const dbStatus = getLastDatabaseStatus();
    if (dbStatus.connected) {
      try {
        await executeQuery(
          `INSERT INTO projects (id, slug, title, short_description, description, category, cover_image, github_url, live_url, demo_url, documentation_url, video_url, status, visibility, architecture, case_study_problem, case_study_solution, case_study_learnings, author_id, featured, published_at, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
          [
            newProj.id,
            newProj.slug,
            newProj.title,
            newProj.shortDesc,
            newProj.description,
            newProj.category,
            newProj.coverImage || null,
            newProj.githubUrl || null,
            newProj.liveUrl || null,
            newProj.demoUrl || null,
            newProj.documentationUrl || null,
            newProj.videoUrl || null,
            newProj.status,
            newProj.visibility,
            newProj.architecture || null,
            newProj.caseStudyProblem || null,
            newProj.caseStudySolution || null,
            newProj.caseStudyLearnings || null,
            newProj.authorId,
            newProj.featured ? 1 : 0,
            publishedAt ? new Date(publishedAt) : null,
          ]
        );

        for (const tech of newProj.techStack) {
          await executeQuery(
            `INSERT INTO project_technologies (project_id, technology_name) VALUES (?, ?)`,
            [newProj.id, tech]
          );
        }
      } catch (err) {
        console.warn('MariaDB insert failed in projectRepository.create:', err);
      }
    }

    db.projects.unshift(newProj);
    return newProj;
  }

  async update(id: string, data: Partial<Project>, authorId?: string): Promise<Project | null> {
    const existing = await this.findById(id);
    if (!existing) return null;

    if (authorId && existing.authorId !== authorId) {
      return null; // Ownership check
    }

    const now = new Date().toISOString();
    const updated: Project = {
      ...existing,
      ...data,
      updatedAt: now,
      publishedAt:
        data.status === 'PUBLISHED' && existing.status !== 'PUBLISHED'
          ? now
          : existing.publishedAt,
    };

    const dbStatus = getLastDatabaseStatus();
    if (dbStatus.connected) {
      try {
        await executeQuery(
          `UPDATE projects SET 
            title = ?, slug = ?, short_description = ?, description = ?, category = ?, 
            cover_image = ?, github_url = ?, live_url = ?, demo_url = ?, documentation_url = ?, video_url = ?,
            status = ?, visibility = ?, architecture = ?, case_study_problem = ?, case_study_solution = ?, 
            case_study_learnings = ?, featured = ?, published_at = ?, updated_at = NOW()
           WHERE id = ?`,
          [
            updated.title,
            updated.slug,
            updated.shortDesc,
            updated.description,
            updated.category,
            updated.coverImage || null,
            updated.githubUrl || null,
            updated.liveUrl || null,
            updated.demoUrl || null,
            updated.documentationUrl || null,
            updated.videoUrl || null,
            updated.status,
            updated.visibility || 'PUBLIC',
            updated.architecture || null,
            updated.caseStudyProblem || null,
            updated.caseStudySolution || null,
            updated.caseStudyLearnings || null,
            updated.featured ? 1 : 0,
            updated.publishedAt ? new Date(updated.publishedAt) : null,
            id,
          ]
        );

        if (data.techStack) {
          await executeQuery(`DELETE FROM project_technologies WHERE project_id = ?`, [id]);
          for (const tech of data.techStack) {
            await executeQuery(
              `INSERT INTO project_technologies (project_id, technology_name) VALUES (?, ?)`,
              [id, tech]
            );
          }
        }
      } catch (err) {
        console.warn('MariaDB update failed in projectRepository.update:', err);
      }
    }

    const idx = db.projects.findIndex((p) => p.id === id);
    if (idx >= 0) {
      db.projects[idx] = updated;
    }
    return updated;
  }

  async delete(id: string, authorId?: string): Promise<boolean> {
    const existing = await this.findById(id);
    if (!existing) return false;

    if (authorId && existing.authorId !== authorId) {
      return false; // Ownership check
    }

    const dbStatus = getLastDatabaseStatus();
    if (dbStatus.connected) {
      try {
        await executeQuery(`DELETE FROM project_technologies WHERE project_id = ?`, [id]);
        await executeQuery(`DELETE FROM project_key_points WHERE project_id = ?`, [id]);
        await executeQuery(`DELETE FROM project_snippets WHERE project_id = ?`, [id]);
        await executeQuery(`DELETE FROM projects WHERE id = ?`, [id]);
      } catch (err) {
        console.warn('MariaDB delete failed in projectRepository.delete:', err);
      }
    }

    const idx = db.projects.findIndex((p) => p.id === id);
    if (idx >= 0) {
      db.projects.splice(idx, 1);
      return true;
    }
    return false;
  }
}

export const projectRepository = new ProjectRepository();
