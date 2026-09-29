import { executeQuery, getLastDatabaseStatus } from '../config/database';
import { Post, Comment } from '../models/types';
import { db } from '../db';

export class CommunityRepository {
  async getPosts(category?: string): Promise<Post[]> {
    const dbStatus = getLastDatabaseStatus();

    if (dbStatus.connected) {
      try {
        let sql = `SELECT * FROM posts WHERE status = 'PUBLISHED'`;
        const params: any[] = [];
        if (category && category !== 'all') {
          sql += ` AND category = ?`;
          params.push(category);
        }
        sql += ` ORDER BY created_at DESC LIMIT 50`;

        const rows = await executeQuery<any>(sql, params);

        const posts: Post[] = await Promise.all(
          rows.map(async (r) => {
            const userRow = await executeQuery<any>(`SELECT username, display_name, avatar_url FROM users WHERE id = ?`, [r.user_id]);
            const tagsRows = await executeQuery<any>(`SELECT tag_name FROM post_tags WHERE post_id = ?`, [r.id]);
            const commentsRows = await executeQuery<any>(`SELECT * FROM comments WHERE post_id = ? ORDER BY created_at ASC`, [r.id]);

            return {
              id: r.id,
              authorId: r.user_id,
              authorName: userRow[0]?.display_name || 'Community Member',
              authorAvatar: userRow[0]?.avatar_url,
              title: r.title,
              content: r.content,
              category: r.category,
              tags: tagsRows.map((t) => t.tag_name),
              likes: r.likes_count || 0,
              comments: commentsRows.map((c) => ({
                id: c.id,
                authorId: c.author_id,
                authorName: c.author_name,
                content: c.content,
                createdAt: c.created_at,
              })),
              createdAt: r.created_at,
            };
          })
        );
        return posts;
      } catch (err) {
        console.warn('MariaDB getPosts failed, using fallback:', err);
      }
    }

    if (category && category !== 'all') {
      return db.posts.filter((p) => p.category === category);
    }
    return db.posts;
  }

  async createPost(post: Post): Promise<Post> {
    const dbStatus = getLastDatabaseStatus();
    if (dbStatus.connected) {
      try {
        await executeQuery(
          `INSERT INTO posts (id, user_id, title, content, category, status, likes_count, created_at)
           VALUES (?, ?, ?, ?, ?, 'PUBLISHED', 0, ?)`,
          [post.id, post.authorId, post.title, post.content, post.category, post.createdAt]
        );

        for (const tag of post.tags) {
          await executeQuery(`INSERT IGNORE INTO post_tags (post_id, tag_name) VALUES (?, ?)`, [post.id, tag]);
        }
      } catch (err) {
        console.warn('MariaDB createPost failed:', err);
      }
    }

    db.posts.unshift(post);
    return post;
  }

  async addComment(postId: string, comment: Comment): Promise<Comment> {
    const dbStatus = getLastDatabaseStatus();
    if (dbStatus.connected) {
      try {
        await executeQuery(
          `INSERT INTO comments (id, post_id, author_id, author_name, content, created_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [comment.id, postId, comment.authorId, comment.authorName, comment.content, comment.createdAt]
        );
      } catch (err) {
        console.warn('MariaDB addComment failed:', err);
      }
    }

    const post = db.posts.find((p) => p.id === postId);
    if (post) {
      post.comments.push(comment);
    }
    return comment;
  }

  async likePost(postId: string): Promise<number> {
    const dbStatus = getLastDatabaseStatus();
    if (dbStatus.connected) {
      try {
        await executeQuery(`UPDATE posts SET likes_count = likes_count + 1 WHERE id = ?`, [postId]);
        const rows = await executeQuery<any>(`SELECT likes_count FROM posts WHERE id = ?`, [postId]);
        if (rows.length > 0) return rows[0].likes_count;
      } catch (err) {
        console.warn('MariaDB likePost failed:', err);
      }
    }

    const post = db.posts.find((p) => p.id === postId);
    if (post) {
      post.likes += 1;
      return post.likes;
    }
    return 1;
  }

  async deletePost(postId: string): Promise<boolean> {
    const dbStatus = getLastDatabaseStatus();
    if (dbStatus.connected) {
      try {
        await executeQuery(`DELETE FROM comments WHERE post_id = ?`, [postId]);
        await executeQuery(`DELETE FROM post_tags WHERE post_id = ?`, [postId]);
        await executeQuery(`DELETE FROM posts WHERE id = ?`, [postId]);
      } catch (err) {
        console.warn('MariaDB deletePost error:', err);
      }
    }

    const idx = db.posts.findIndex((p) => p.id === postId);
    if (idx >= 0) {
      db.posts.splice(idx, 1);
      return true;
    }
    return false;
  }

  async deleteComment(postId: string, commentId: string): Promise<boolean> {
    const dbStatus = getLastDatabaseStatus();
    if (dbStatus.connected) {
      try {
        await executeQuery(`DELETE FROM comments WHERE id = ? AND post_id = ?`, [commentId, postId]);
      } catch (err) {
        console.warn('MariaDB deleteComment error:', err);
      }
    }

    const post = db.posts.find((p) => p.id === postId);
    if (post) {
      const cIdx = post.comments.findIndex((c) => c.id === commentId);
      if (cIdx >= 0) {
        post.comments.splice(cIdx, 1);
        return true;
      }
    }
    return false;
  }
}

export const communityRepository = new CommunityRepository();
