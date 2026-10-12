import { beforeEach, describe, expect, it, vi } from 'vitest';

const database = vi.hoisted(() => ({
  getLastDatabaseStatus: vi.fn(() => ({ connected: true })),
  executeQuery: vi.fn(),
  withTransaction: vi.fn((cb: any) => cb({
    execute: vi.fn().mockResolvedValue([{ affectedRows: 1 }]),
  })),
}));

vi.mock('../config/database', () => database);

import { communityRepository } from '../repositories/communityRepository';
import { creatorApplicationRepository } from '../repositories/creatorApplicationRepository';
import { userRepository } from '../repositories/userRepository';

beforeEach(() => {
  vi.clearAllMocks();
  database.getLastDatabaseStatus.mockReturnValue({ connected: true });
});

describe('Community Repository CRUD & Ownership', () => {
  it('allows author to update their own post', async () => {
    database.executeQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('SELECT user_id FROM posts')) {
        return [{ user_id: 'user-author-1' }];
      }
      if (sql.includes('SELECT * FROM posts WHERE id')) {
        return [{
          id: 'post-1',
          user_id: 'user-author-1',
          title: 'Updated Title',
          content: 'Updated Content',
          category: 'DevOps',
          status: 'PUBLISHED',
          likes_count: 5,
          created_at: '2026-01-01',
        }];
      }
      if (sql.includes('FROM users')) return [{ username: 'author', display_name: 'Author' }];
      if (sql.includes('FROM post_tags')) return [{ tag_name: 'Docker' }];
      if (sql.includes('FROM comments')) return [];
      return [];
    });

    const updated = await communityRepository.updatePost(
      'post-1',
      'user-author-1',
      false,
      { title: 'Updated Title', content: 'Updated Content' }
    );

    expect(updated).not.toBeNull();
    expect(updated?.title).toBe('Updated Title');
  });

  it('rejects post update from non-author without admin/moderator role', async () => {
    database.executeQuery.mockResolvedValueOnce([{ user_id: 'user-author-1' }]);

    await expect(
      communityRepository.updatePost('post-1', 'unauthorized-user', false, { title: 'Hacked' })
    ).rejects.toThrow('Keine Berechtigung zum Bearbeiten dieses Beitrags.');
  });

  it('allows moderator or admin to update or delete any post', async () => {
    database.executeQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('SELECT user_id FROM posts')) {
        return [{ user_id: 'user-author-1' }];
      }
      if (sql.includes('SELECT * FROM posts WHERE id')) {
        return [{
          id: 'post-1',
          user_id: 'user-author-1',
          title: 'Mod Title',
          content: 'Content',
          category: 'DevOps',
          status: 'PUBLISHED',
          likes_count: 0,
          created_at: '2026-01-01',
        }];
      }
      return [];
    });

    const updated = await communityRepository.updatePost(
      'post-1',
      'admin-user',
      true,
      { title: 'Mod Title' }
    );
    expect(updated).not.toBeNull();

    const deleted = await communityRepository.deletePost('post-1', 'admin-user', true);
    expect(deleted).toBe(true);
  });

  it('allows author to update and delete their own comment', async () => {
    database.executeQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('SELECT author_id FROM comments')) {
        return [{ author_id: 'comm-author' }];
      }
      if (sql.includes('SELECT * FROM comments WHERE id')) {
        return [{
          id: 'comm-1',
          author_id: 'comm-author',
          author_name: 'Author',
          content: 'Updated Comment',
          created_at: '2026-01-01',
        }];
      }
      if (sql.includes('DELETE FROM comments')) {
        return [{ affectedRows: 1 }];
      }
      return [];
    });

    const updated = await communityRepository.updateComment(
      'post-1',
      'comm-1',
      'comm-author',
      false,
      'Updated Comment'
    );
    expect(updated?.content).toBe('Updated Comment');

    const deleted = await communityRepository.deleteComment('post-1', 'comm-1', 'comm-author', false);
    expect(deleted).toBe(true);
  });
});

describe('Creator Application Workflow', () => {
  it('creates a pending application and allows retrieval', async () => {
    database.executeQuery.mockResolvedValue([]);

    const app = await creatorApplicationRepository.create({
      userId: 'user-123',
      motivation: 'Want to share C# tutorials',
      plannedProjects: 'WPF Architecture',
      plannedContent: 'Templates & Guides',
    });

    expect(app.id).toBeDefined();
    expect(app.status).toBe('PENDING');
    expect(app.userId).toBe('user-123');
  });

  it('reviews application and approves it', async () => {
    database.executeQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('UPDATE creator_applications')) return [{ affectedRows: 1 }];
      if (sql.includes('FROM creator_applications WHERE id')) {
        return [{
          id: 'app-1',
          user_id: 'user-123',
          portfolio_url: null,
          motivation: 'Motivation',
          planned_projects: 'Projects',
          planned_content: 'Content',
          status: 'APPROVED',
          admin_notes: 'Great work',
          reviewed_by: 'admin-1',
          reviewed_at: '2026-01-01',
          created_at: '2026-01-01',
        }];
      }
      return [];
    });

    const reviewed = await creatorApplicationRepository.review('app-1', 'APPROVED', 'admin-1', 'Great work');
    expect(reviewed?.status).toBe('APPROVED');
    expect(reviewed?.adminNotes).toBe('Great work');
  });
});

describe('Community Reports & Moderation', () => {
  it('creates and retrieves reports', async () => {
    database.executeQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('INSERT INTO community_reports')) return [{ affectedRows: 1 }];
      if (sql.includes('FROM community_reports')) {
        return [{
          id: 'rep-1',
          reporter_id: 'user-rep',
          reporter_username: 'reporter_user',
          post_id: 'post-1',
          post_title: 'Spam Post',
          comment_id: null,
          reason: 'Spamming commercial links',
          status: 'PENDING',
          created_at: '2026-01-01',
        }];
      }
      return [];
    });

    const report = await communityRepository.createReport({
      id: 'rep-1',
      reporterId: 'user-rep',
      postId: 'post-1',
      reason: 'Spamming commercial links',
    });

    expect(report.status).toBe('PENDING');

    const list = await communityRepository.getReports('PENDING');
    expect(list.length).toBe(1);
    expect(list[0].reason).toBe('Spamming commercial links');
  });
});
