import { executeQuery, getLastDatabaseStatus, withTransaction } from '../config/database';
import { Post, Comment } from '../models/types';

export class CommunityRepository {
  async getPosts(category?: string): Promise<Post[]> {
    if (!getLastDatabaseStatus().connected) {
      throw new Error('MariaDB ist nicht erreichbar. Community-Beiträge sind derzeit nicht verfügbar.');
    }
    let sql = `SELECT * FROM posts WHERE status = 'PUBLISHED'`;
    const params: string[] = [];
    if (category && category !== 'all') {
      sql += ` AND category = ?`;
      params.push(category);
    }
    sql += ` ORDER BY created_at DESC LIMIT 50`;
    const rows = await executeQuery<any>(sql, params);
    return Promise.all(rows.map(async (row): Promise<Post> => {
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
        comments: commentRows.map((comment) => ({
          id: comment.id,
          authorId: comment.author_id,
          authorName: comment.author_name,
          content: comment.content,
          createdAt: comment.created_at,
        })),
        createdAt: row.created_at,
      };
    }));
  }

  async createPost(post: Post): Promise<Post> {
    if (!getLastDatabaseStatus().connected) throw new Error('MariaDB ist nicht erreichbar. Der Beitrag wurde nicht gespeichert.');
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

  async addComment(postId: string, comment: Comment): Promise<Comment> {
    if (!getLastDatabaseStatus().connected) throw new Error('MariaDB ist nicht erreichbar. Der Kommentar wurde nicht gespeichert.');
    await executeQuery(
      `INSERT INTO comments (id, post_id, author_id, author_name, content, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [comment.id, postId, comment.authorId, comment.authorName, comment.content, comment.createdAt]
    );
    return comment;
  }

  async likePost(postId: string): Promise<number> {
    if (!getLastDatabaseStatus().connected) throw new Error('MariaDB ist nicht erreichbar. Der Beitrag konnte nicht aktualisiert werden.');
    await executeQuery(`UPDATE posts SET likes_count = likes_count + 1 WHERE id = ?`, [postId]);
    const rows = await executeQuery<any>(`SELECT likes_count FROM posts WHERE id = ?`, [postId]);
    if (!rows.length) throw new Error('Beitrag nicht gefunden.');
    return Number(rows[0].likes_count);
  }

  async deletePost(postId: string): Promise<boolean> {
    if (!getLastDatabaseStatus().connected) throw new Error('MariaDB ist nicht erreichbar. Der Beitrag konnte nicht gelöscht werden.');
    const [result] = await withTransaction(async (connection) => {
      await connection.execute(`DELETE FROM comments WHERE post_id = ?`, [postId]);
      await connection.execute(`DELETE FROM post_tags WHERE post_id = ?`, [postId]);
      return connection.execute(`DELETE FROM posts WHERE id = ?`, [postId]);
    });
    return (result as { affectedRows: number }).affectedRows > 0;
  }

  async deleteComment(postId: string, commentId: string): Promise<boolean> {
    if (!getLastDatabaseStatus().connected) throw new Error('MariaDB ist nicht erreichbar. Der Kommentar konnte nicht gelöscht werden.');
    const result = await executeQuery<any>(`DELETE FROM comments WHERE id = ? AND post_id = ?`, [commentId, postId]);
    return Number(result[0]?.affectedRows) > 0;
  }
}

export const communityRepository = new CommunityRepository();
