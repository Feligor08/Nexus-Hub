import { executeQuery, getLastDatabaseStatus, withTransaction } from '../config/database';
import { Post, Comment, CommunityReport } from '../models/types';

export class CommunityRepository {
  async getPosts(options?: { category?: string; search?: string; tag?: string } | string): Promise<Post[]> {
    if (!getLastDatabaseStatus().connected) {
      throw new Error('MariaDB ist nicht erreichbar. Community-Beiträge sind derzeit nicht verfügbar.');
    }

    const opts = typeof options === 'string' ? { category: options } : options || {};
    let sql = `SELECT * FROM posts WHERE status = 'PUBLISHED'`;
    const params: string[] = [];

    if (opts.category && opts.category !== 'all') {
      sql += ` AND category = ?`;
      params.push(opts.category);
    }

    if (opts.search && opts.search.trim()) {
      sql += ` AND (title LIKE ? OR content LIKE ?)`;
      const q = `%${opts.search.trim()}%`;
      params.push(q, q);
    }

    if (opts.tag && opts.tag.trim()) {
      sql += ` AND id IN (SELECT post_id FROM post_tags WHERE tag_name = ?)`;
      params.push(opts.tag.trim());
    }

    sql += ` ORDER BY created_at DESC LIMIT 50`;
    const rows = await executeQuery<any>(sql, params);
    return Promise.all(
      rows.map(async (row): Promise<Post> => {
        const [userRows, tagsRows, commentRows] = await Promise.all([
          executeQuery<any>(`SELECT username, display_name, avatar_url FROM users WHERE id = ?`, [row.user_id]),
          executeQuery<any>(`SELECT tag_name FROM post_tags WHERE post_id = ?`, [row.id]),
          executeQuery<any>(`SELECT * FROM comments WHERE post_id = ? ORDER BY created_at ASC`, [row.id]),
        ]);
        return {
          id: row.id,
          authorId: row.user_id,
          authorName: userRows[0]?.display_name || 'Community Member',
          authorUsername: userRows[0]?.username,
          authorAvatar: userRows[0]?.avatar_url,
          title: row.title,
          content: row.content,
          category: row.category,
          tags: tagsRows.map((tag) => tag.tag_name),
          likes: Number(row.likes_count || 0),
          status: row.status as any,
          comments: commentRows.map((comment) => ({
            id: comment.id,
            authorId: comment.author_id,
            authorName: comment.author_name,
            content: comment.content,
            createdAt: comment.created_at,
          })),
          createdAt: row.created_at,
        };
      })
    );
  }

  async getPostById(postId: string): Promise<Post | null> {
    if (!getLastDatabaseStatus().connected) {
      throw new Error('MariaDB ist nicht erreichbar. Community-Beiträge sind derzeit nicht verfügbar.');
    }

    const rows = await executeQuery<any>(`SELECT * FROM posts WHERE id = ? LIMIT 1`, [postId]);
    if (!rows.length) return null;
    const row = rows[0];

    const [userRows, tagsRows, commentRows] = await Promise.all([
      executeQuery<any>(`SELECT username, display_name, avatar_url FROM users WHERE id = ?`, [row.user_id]),
      executeQuery<any>(`SELECT tag_name FROM post_tags WHERE post_id = ?`, [row.id]),
      executeQuery<any>(`SELECT * FROM comments WHERE post_id = ? ORDER BY created_at ASC`, [row.id]),
    ]);

    return {
      id: row.id,
      authorId: row.user_id,
      authorName: userRows[0]?.display_name || 'Community Member',
      authorUsername: userRows[0]?.username,
      authorAvatar: userRows[0]?.avatar_url,
      title: row.title,
      content: row.content,
      category: row.category,
      tags: tagsRows.map((tag) => tag.tag_name),
      likes: Number(row.likes_count || 0),
      status: row.status as any,
      comments: commentRows.map((comment) => ({
        id: comment.id,
        authorId: comment.author_id,
        authorName: comment.author_name,
        content: comment.content,
        createdAt: comment.created_at,
      })),
      createdAt: row.created_at,
    };
  }

  async createPost(post: Post): Promise<Post> {
    if (!getLastDatabaseStatus().connected) {
      throw new Error('MariaDB ist nicht erreichbar. Der Beitrag wurde nicht gespeichert.');
    }
    await withTransaction(async (connection) => {
      await connection.execute(
        `INSERT INTO posts (id, user_id, title, content, category, status, likes_count, created_at)
         VALUES (?, ?, ?, ?, ?, 'PUBLISHED', 0, ?)`,
        [post.id, post.authorId, post.title, post.content, post.category, post.createdAt]
      );
      for (const tag of post.tags) {
        await connection.execute(`INSERT IGNORE INTO post_tags (post_id, tag_name) VALUES (?, ?)`, [post.id, tag]);
      }
    });
    return post;
  }

  async updatePost(
    postId: string,
    userId: string,
    isAdminOrMod: boolean,
    data: { title?: string; content?: string; category?: string; tags?: string[] }
  ): Promise<Post | null> {
    if (!getLastDatabaseStatus().connected) {
      throw new Error('MariaDB ist nicht erreichbar. Der Beitrag konnte nicht aktualisiert werden.');
    }

    const postRows = await executeQuery<any>(`SELECT user_id FROM posts WHERE id = ? LIMIT 1`, [postId]);
    if (!postRows.length) return null;
    const authorId = postRows[0].user_id;

    if (authorId !== userId && !isAdminOrMod) {
      throw new Error('Keine Berechtigung zum Bearbeiten dieses Beitrags.');
    }

    await withTransaction(async (connection) => {
      const updates: string[] = [];
      const params: any[] = [];

      if (data.title !== undefined) {
        updates.push('title = ?');
        params.push(data.title);
      }
      if (data.content !== undefined) {
        updates.push('content = ?');
        params.push(data.content);
      }
      if (data.category !== undefined) {
        updates.push('category = ?');
        params.push(data.category);
      }

      if (updates.length > 0) {
        params.push(postId);
        await connection.execute(`UPDATE posts SET ${updates.join(', ')} WHERE id = ?`, params);
      }

      if (data.tags !== undefined) {
        await connection.execute(`DELETE FROM post_tags WHERE post_id = ?`, [postId]);
        for (const tag of data.tags) {
          if (tag.trim()) {
            await connection.execute(`INSERT IGNORE INTO post_tags (post_id, tag_name) VALUES (?, ?)`, [postId, tag.trim()]);
          }
        }
      }
    });

    return this.getPostById(postId);
  }

  async deletePost(postId: string, userId?: string, isAdminOrMod?: boolean): Promise<boolean> {
    if (!getLastDatabaseStatus().connected) {
      throw new Error('MariaDB ist nicht erreichbar. Der Beitrag konnte nicht gelöscht werden.');
    }

    if (userId && !isAdminOrMod) {
      const postRows = await executeQuery<any>(`SELECT user_id FROM posts WHERE id = ? LIMIT 1`, [postId]);
      if (!postRows.length) return false;
      if (postRows[0].user_id !== userId) {
        throw new Error('Keine Berechtigung zum Löschen dieses Beitrags.');
      }
    }

    const [result] = await withTransaction(async (connection) => {
      await connection.execute(`DELETE FROM comments WHERE post_id = ?`, [postId]);
      await connection.execute(`DELETE FROM post_tags WHERE post_id = ?`, [postId]);
      try {
        await connection.execute(`DELETE FROM community_reports WHERE post_id = ?`, [postId]);
      } catch {
        // Table may not exist yet if migrations deferred
      }
      return connection.execute(`DELETE FROM posts WHERE id = ?`, [postId]);
    });
    return (result as { affectedRows: number }).affectedRows > 0;
  }

  async addComment(postId: string, comment: Comment): Promise<Comment> {
    if (!getLastDatabaseStatus().connected) {
      throw new Error('MariaDB ist nicht erreichbar. Der Kommentar wurde nicht gespeichert.');
    }
    await executeQuery(
      `INSERT INTO comments (id, post_id, author_id, author_name, content, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [comment.id, postId, comment.authorId, comment.authorName, comment.content, comment.createdAt]
    );
    return comment;
  }

  async updateComment(
    postId: string,
    commentId: string,
    userId: string,
    isAdminOrMod: boolean,
    content: string
  ): Promise<Comment | null> {
    if (!getLastDatabaseStatus().connected) {
      throw new Error('MariaDB ist nicht erreichbar. Der Kommentar konnte nicht aktualisiert werden.');
    }

    const rows = await executeQuery<any>(`SELECT author_id FROM comments WHERE id = ? AND post_id = ? LIMIT 1`, [commentId, postId]);
    if (!rows.length) return null;

    if (rows[0].author_id !== userId && !isAdminOrMod) {
      throw new Error('Keine Berechtigung zum Bearbeiten dieses Kommentars.');
    }

    await executeQuery(`UPDATE comments SET content = ? WHERE id = ? AND post_id = ?`, [content, commentId, postId]);
    const updated = await executeQuery<any>(`SELECT * FROM comments WHERE id = ? AND post_id = ? LIMIT 1`, [commentId, postId]);
    if (!updated.length) return null;
    return {
      id: updated[0].id,
      authorId: updated[0].author_id,
      authorName: updated[0].author_name,
      content: updated[0].content,
      createdAt: updated[0].created_at,
    };
  }

  async deleteComment(postId: string, commentId: string, userId?: string, isAdminOrMod?: boolean): Promise<boolean> {
    if (!getLastDatabaseStatus().connected) {
      throw new Error('MariaDB ist nicht erreichbar. Der Kommentar konnte nicht gelöscht werden.');
    }

    if (userId && !isAdminOrMod) {
      const rows = await executeQuery<any>(`SELECT author_id FROM comments WHERE id = ? AND post_id = ? LIMIT 1`, [commentId, postId]);
      if (!rows.length) return false;
      if (rows[0].author_id !== userId) {
        throw new Error('Keine Berechtigung zum Löschen dieses Kommentars.');
      }
    }

    try {
      await executeQuery(`DELETE FROM community_reports WHERE comment_id = ?`, [commentId]);
    } catch {
      // Ignore
    }

    const result = await executeQuery<any>(`DELETE FROM comments WHERE id = ? AND post_id = ?`, [commentId, postId]);
    return Number((result as any)?.affectedRows ?? (result as any)?.[0]?.affectedRows ?? 0) > 0;
  }

  async likePost(postId: string): Promise<number> {
    if (!getLastDatabaseStatus().connected) {
      throw new Error('MariaDB ist nicht erreichbar. Der Beitrag konnte nicht aktualisiert werden.');
    }
    await executeQuery(`UPDATE posts SET likes_count = likes_count + 1 WHERE id = ?`, [postId]);
    const rows = await executeQuery<any>(`SELECT likes_count FROM posts WHERE id = ?`, [postId]);
    if (!rows.length) throw new Error('Beitrag nicht gefunden.');
    return Number(rows[0].likes_count);
  }

  // -------------------------------------------------------------
  // REPORTS & MODERATION WORKFLOW
  // -------------------------------------------------------------
  async createReport(report: {
    id: string;
    reporterId: string;
    postId?: string;
    commentId?: string;
    reason: string;
  }): Promise<CommunityReport> {
    if (!getLastDatabaseStatus().connected) {
      throw new Error('MariaDB ist nicht erreichbar. Die Meldung konnte nicht gespeichert werden.');
    }

    const now = new Date().toISOString();
    await executeQuery(
      `INSERT INTO community_reports (id, reporter_id, post_id, comment_id, reason, status, created_at)
       VALUES (?, ?, ?, ?, ?, 'PENDING', ?)`,
      [report.id, report.reporterId, report.postId || null, report.commentId || null, report.reason, now]
    );

    return {
      id: report.id,
      reporterId: report.reporterId,
      postId: report.postId,
      commentId: report.commentId,
      reason: report.reason,
      status: 'PENDING',
      createdAt: now,
    };
  }

  async getReports(status?: string): Promise<CommunityReport[]> {
    if (!getLastDatabaseStatus().connected) {
      return [];
    }

    try {
      let sql = `
        SELECT cr.*, u.username as reporter_username, p.title as post_title, rev.username as reviewer_username
        FROM community_reports cr
        LEFT JOIN users u ON cr.reporter_id = u.id
        LEFT JOIN posts p ON cr.post_id = p.id
        LEFT JOIN users rev ON cr.reviewer_id = rev.id
        WHERE 1=1
      `;
      const params: any[] = [];
      if (status && status !== 'all') {
        sql += ` AND cr.status = ?`;
        params.push(status);
      }
      sql += ` ORDER BY cr.created_at DESC LIMIT 100`;

      const rows = await executeQuery<any>(sql, params);
      return rows.map((r) => ({
        id: r.id,
        reporterId: r.reporter_id,
        reporterUsername: r.reporter_username || 'Unbekannt',
        postId: r.post_id || undefined,
        postTitle: r.post_title || undefined,
        commentId: r.comment_id || undefined,
        reason: r.reason,
        status: r.status,
        reviewerId: r.reviewer_id || undefined,
        reviewerUsername: r.reviewer_username || undefined,
        reviewNotes: r.review_notes || undefined,
        createdAt: r.created_at,
        resolvedAt: r.resolved_at || undefined,
      }));
    } catch (err) {
      console.warn('Failed to fetch community reports:', err);
      return [];
    }
  }

  async reviewReport(
    reportId: string,
    reviewerId: string,
    status: 'RESOLVED' | 'DISMISSED',
    reviewNotes?: string
  ): Promise<CommunityReport | null> {
    if (!getLastDatabaseStatus().connected) {
      throw new Error('MariaDB ist nicht erreichbar. Meldung konnte nicht aktualisiert werden.');
    }

    const now = new Date().toISOString();
    await executeQuery(
      `UPDATE community_reports SET status = ?, reviewer_id = ?, review_notes = ?, resolved_at = ? WHERE id = ?`,
      [status, reviewerId, reviewNotes || null, now, reportId]
    );

    const reports = await this.getReports();
    return reports.find((r) => r.id === reportId) || null;
  }
}

export const communityRepository = new CommunityRepository();

