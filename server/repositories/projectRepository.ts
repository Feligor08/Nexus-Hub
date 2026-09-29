import { executeQuery, getLastDatabaseStatus, withTransaction } from '../config/database';
import { Project, ContentStatus } from '../models/types';

export class ProjectRepository {
  private async validateMediaReferences(
    connection: import('mysql2/promise').PoolConnection,
    project: Project,
    allowForeignOwner: boolean
  ): Promise<void> {
    const mediaIds = [...new Set([project.coverMediaId, ...(project.galleryMediaIds || [])].filter((id): id is string => Boolean(id)))];
    for (const mediaId of mediaIds) {
      const [rows] = await connection.execute<Array<import('mysql2').RowDataPacket & { owner_id: string; file_category: string }>>(
        `SELECT owner_id, file_category FROM media_files WHERE id = ? LIMIT 1 FOR UPDATE`,
        [mediaId]
      );
      const media = rows[0];
      if (!media || (!allowForeignOwner && media.owner_id !== project.authorId)) {
        throw new Error('Mediendatei nicht gefunden oder nicht im eigenen Besitz.');
      }
      if (media.file_category !== 'image') throw new Error('Projektcover und Galerie benötigen Bilddateien.');
    }
  }

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
    if (!dbStatus.connected) throw new Error('MariaDB ist nicht erreichbar. Projekte sind derzeit nicht verfügbar.');

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
          sql += ` AND visibility = ?`;
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
            const [techRows, galleryRows] = await Promise.all([
              executeQuery<any>(
                `SELECT technology_name FROM project_technologies WHERE project_id = ?`,
                [r.id]
              ),
              executeQuery<any>(
                `SELECT media_id FROM project_media WHERE project_id = ? ORDER BY sort_order`,
                [r.id]
              ),
            ]);
            return {
              id: r.id,
              slug: r.slug,
              title: r.title,
              shortDesc: r.short_description || '',
              description: r.description || '',
              category: r.category || 'Software',
              techStack: techRows.map((t) => t.technology_name),
              coverImage: r.cover_media_id ? `/api/media/${encodeURIComponent(r.cover_media_id)}/file` : undefined,
              coverMediaId: r.cover_media_id || undefined,
              galleryImages: galleryRows.map((image) => `/api/media/${encodeURIComponent(image.media_id)}/file`),
              galleryMediaIds: galleryRows.map((image) => image.media_id),
              githubUrl: r.github_url,
              liveUrl: r.live_url,
              demoUrl: r.demo_url,
              documentationUrl: r.documentation_url,
              videoUrl: r.video_url,
              status: r.status || 'PUBLISHED',
              visibility: r.visibility || 'PUBLIC',
              problem: r.case_study_problem || r.problem || '',
              solution: r.case_study_solution || r.solution || '',
              goal: r.case_study_goal || '',
              result: r.case_study_result || '',
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
        throw err;
      }
    }
    throw new Error('Projektabfrage konnte nicht abgeschlossen werden.');
  }

  async findBySlug(slug: string): Promise<Project | null> {
    const dbStatus = getLastDatabaseStatus();
    if (!dbStatus.connected) throw new Error('MariaDB ist nicht erreichbar. Projekte sind derzeit nicht verfügbar.');
    if (dbStatus.connected) {
      try {
        const rows = await executeQuery<any>(`SELECT * FROM projects WHERE slug = ? LIMIT 1`, [slug]);
        if (rows.length > 0) {
          const r = rows[0];
          const [techRows, galleryRows] = await Promise.all([
            executeQuery<any>(
              `SELECT technology_name FROM project_technologies WHERE project_id = ?`,
              [r.id]
            ),
            executeQuery<any>(
              `SELECT media_id FROM project_media WHERE project_id = ? ORDER BY sort_order`,
              [r.id]
            ),
          ]);
          return {
            id: r.id,
            slug: r.slug,
            title: r.title,
            shortDesc: r.short_description || '',
            description: r.description || '',
            category: r.category || 'Software',
            techStack: techRows.map((t) => t.technology_name),
            coverImage: r.cover_media_id ? `/api/media/${encodeURIComponent(r.cover_media_id)}/file` : undefined,
            coverMediaId: r.cover_media_id || undefined,
            galleryImages: galleryRows.map((image) => `/api/media/${encodeURIComponent(image.media_id)}/file`),
            galleryMediaIds: galleryRows.map((image) => image.media_id),
            githubUrl: r.github_url,
            liveUrl: r.live_url,
            demoUrl: r.demo_url,
            documentationUrl: r.documentation_url,
            videoUrl: r.video_url,
            status: r.status || 'PUBLISHED',
            visibility: r.visibility || 'PUBLIC',
            problem: r.case_study_problem || r.problem || '',
            solution: r.case_study_solution || r.solution || '',
            goal: r.case_study_goal || '',
            result: r.case_study_result || '',
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
        throw err;
      }
    }

    return null;
  }

  async findById(id: string): Promise<Project | null> {
    const dbStatus = getLastDatabaseStatus();
    if (!dbStatus.connected) throw new Error('MariaDB ist nicht erreichbar. Projekte sind derzeit nicht verfügbar.');
    if (dbStatus.connected) {
      try {
        const rows = await executeQuery<any>(`SELECT slug FROM projects WHERE id = ? LIMIT 1`, [id]);
        if (rows.length > 0) {
          return this.findBySlug(rows[0].slug);
        }
      } catch (err) {
        throw err;
      }
    }
    return null;
  }

  async create(data: Partial<Project>, allowForeignMedia = false): Promise<Project> {
    if (!data.authorId) {
      throw new Error('Projekt benötigt eine serverseitig bestimmte Autor-ID.');
    }
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
      coverImage: undefined,
      coverMediaId: data.coverMediaId,
      galleryImages: [],
      galleryMediaIds: data.galleryMediaIds || [],
      githubUrl: data.githubUrl,
      liveUrl: data.liveUrl,
      demoUrl: data.demoUrl,
      documentationUrl: data.documentationUrl,
      videoUrl: data.videoUrl,
      status,
      visibility: data.visibility || 'PUBLIC',
      problem: data.problem || data.caseStudyProblem || '',
      solution: data.solution || data.caseStudySolution || '',
      goal: data.goal || '',
      result: data.result || '',
      architecture: data.architecture || '',
      caseStudyProblem: data.caseStudyProblem || data.problem || '',
      caseStudySolution: data.caseStudySolution || data.solution || '',
      caseStudyLearnings: data.caseStudyLearnings || '',
      keyFeatures: data.keyFeatures || [],
      authorId: data.authorId,
      featured: Boolean(data.featured),
      publishedAt,
      createdAt: now,
      updatedAt: now,
    };

    const dbStatus = getLastDatabaseStatus();
    if (!dbStatus.connected) {
      throw new Error('MariaDB ist nicht erreichbar; das Projekt wurde nicht gespeichert.');
    }

    await withTransaction(async (connection) => {
      await this.validateMediaReferences(connection, newProj, allowForeignMedia);
      await connection.execute(
        `INSERT INTO projects (id, slug, title, short_description, description, category, cover_image, cover_media_id, github_url, live_url, demo_url, documentation_url, video_url, status, visibility, architecture, case_study_problem, case_study_solution, case_study_learnings, case_study_goal, case_study_result, author_id, featured, published_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [
            newProj.id,
            newProj.slug,
            newProj.title,
            newProj.shortDesc,
            newProj.description,
            newProj.category,
            newProj.coverMediaId || null,
            newProj.githubUrl || null,
            newProj.liveUrl || null,
            newProj.demoUrl || null,
            newProj.documentationUrl || null,
            newProj.videoUrl || null,
            newProj.status,
            newProj.visibility || 'PUBLIC',
            newProj.architecture || null,
            newProj.caseStudyProblem || null,
            newProj.caseStudySolution || null,
            newProj.caseStudyLearnings || null,
            newProj.goal || null,
            newProj.result || null,
            newProj.authorId,
            newProj.featured ? 1 : 0,
            publishedAt ? new Date(publishedAt) : null,
        ]
      );

      for (const tech of newProj.techStack) {
        await connection.execute(
            `INSERT INTO project_technologies (project_id, technology_name) VALUES (?, ?)`,
            [newProj.id, tech]
        );
      }

      for (const [sortOrder, mediaId] of newProj.galleryMediaIds!.entries()) {
        await connection.execute(
          `INSERT INTO project_media (project_id, media_id, sort_order) VALUES (?, ?, ?)`,
          [newProj.id, mediaId, sortOrder]
        );
      }
    });

    return newProj;
  }

  async update(id: string, data: Partial<Project>, authorId?: string, allowForeignMedia = false): Promise<Project | null> {
    const existing = await this.findById(id);
    if (!existing) return null;

    if (authorId && existing.authorId !== authorId) {
      return null; // Ownership check
    }

    const now = new Date().toISOString();
    const updated: Project = {
      ...existing,
      ...data,
      id: existing.id,
      authorId: existing.authorId,
      coverImage: undefined,
      coverMediaId: data.coverMediaId !== undefined ? data.coverMediaId : existing.coverMediaId,
      galleryImages: [],
      galleryMediaIds: data.galleryMediaIds !== undefined ? data.galleryMediaIds : existing.galleryMediaIds || [],
      createdAt: existing.createdAt,
      updatedAt: now,
      publishedAt:
        data.status === 'PUBLISHED' && existing.status !== 'PUBLISHED'
          ? now
          : existing.publishedAt,
    };

    const dbStatus = getLastDatabaseStatus();
    if (!dbStatus.connected) {
      throw new Error('MariaDB ist nicht erreichbar; das Projekt wurde nicht gespeichert.');
    }

    await withTransaction(async (connection) => {
      await this.validateMediaReferences(connection, updated, allowForeignMedia);
      const ownershipClause = authorId ? ' AND author_id = ?' : '';
      const values = [
        updated.title,
        updated.slug,
        updated.shortDesc,
        updated.description,
        updated.category,
        updated.coverMediaId || null,
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
        updated.goal || null,
        updated.result || null,
        updated.featured ? 1 : 0,
        updated.publishedAt ? new Date(updated.publishedAt) : null,
        id,
        ...(authorId ? [authorId] : []),
      ];

      await connection.execute(
        `UPDATE projects SET
            title = ?, slug = ?, short_description = ?, description = ?, category = ?, 
            cover_image = NULL, cover_media_id = ?, github_url = ?, live_url = ?, demo_url = ?, documentation_url = ?, video_url = ?,
            status = ?, visibility = ?, architecture = ?, case_study_problem = ?, case_study_solution = ?, 
            case_study_learnings = ?, case_study_goal = ?, case_study_result = ?,
            featured = ?, published_at = ?, updated_at = NOW()
           WHERE id = ?${ownershipClause}`,
        values
      );

      if (data.techStack !== undefined) {
        await connection.execute(`DELETE FROM project_technologies WHERE project_id = ?`, [id]);
        for (const tech of data.techStack) {
          await connection.execute(
              `INSERT INTO project_technologies (project_id, technology_name) VALUES (?, ?)`,
              [id, tech]
          );
        }
      }

      if (data.galleryMediaIds !== undefined) {
        await connection.execute(`DELETE FROM project_media WHERE project_id = ?`, [id]);
        for (const [sortOrder, mediaId] of updated.galleryMediaIds!.entries()) {
          await connection.execute(
            `INSERT INTO project_media (project_id, media_id, sort_order) VALUES (?, ?, ?)`,
            [id, mediaId, sortOrder]
          );
        }
      }
    });

    return updated;
  }

  async delete(id: string, authorId?: string): Promise<boolean> {
    const existing = await this.findById(id);
    if (!existing) return false;

    if (authorId && existing.authorId !== authorId) {
      return false; // Ownership check
    }

    const dbStatus = getLastDatabaseStatus();
    if (!dbStatus.connected) {
      throw new Error('MariaDB ist nicht erreichbar; das Projekt wurde nicht gelöscht.');
    }

    const [deleteResult] = await withTransaction(async (connection) => {
      const ownershipClause = authorId ? ' AND author_id = ?' : '';
      return connection.execute(
        `DELETE FROM projects WHERE id = ?${ownershipClause}`,
        authorId ? [id, authorId] : [id]
      );
    });

    const wasDeleted = (deleteResult as { affectedRows: number }).affectedRows > 0;
    if (!wasDeleted) return false;

    return true;
  }
}

export const projectRepository = new ProjectRepository();
