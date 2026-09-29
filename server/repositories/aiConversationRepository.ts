import { executeQuery, getLastDatabaseStatus } from '../config/database';
import { AiConversation, AiMessage } from '../models/types';

const inMemoryConversations: AiConversation[] = [];
const inMemoryMessages: AiMessage[] = [];

export class AiConversationRepository {
  async createConversation(userId: string, title: string, roleId: string = 'general'): Promise<AiConversation> {
    const conv: AiConversation = {
      id: `conv-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      userId,
      title,
      role: roleId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const dbStatus = getLastDatabaseStatus();
    if (dbStatus.connected) {
      try {
        await executeQuery(
          `INSERT INTO ai_conversations (id, user_id, title, role_id, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [conv.id, conv.userId, conv.title, conv.role, conv.createdAt, conv.updatedAt]
        );
      } catch (err) {
        console.warn('MariaDB createConversation failed:', err);
      }
    }

    inMemoryConversations.unshift(conv);
    return conv;
  }

  async getConversations(userId: string): Promise<AiConversation[]> {
    const dbStatus = getLastDatabaseStatus();
    if (dbStatus.connected) {
      try {
        const rows = await executeQuery<any>(
          `SELECT id, user_id, title, role_id as role, created_at, updated_at 
           FROM ai_conversations WHERE user_id = ? ORDER BY updated_at DESC LIMIT 30`,
          [userId]
        );
        return rows.map((r) => ({
          id: r.id,
          userId: r.user_id,
          title: r.title,
          role: r.role,
          createdAt: r.created_at,
          updatedAt: r.updated_at,
        }));
      } catch (err) {
        console.warn('MariaDB getConversations failed:', err);
      }
    }

    return inMemoryConversations.filter((c) => c.userId === userId);
  }

  async addMessage(conversationId: string, role: 'user' | 'assistant' | 'system', content: string, model: string = 'gemini-3.5-flash'): Promise<AiMessage> {
    const msg: AiMessage = {
      id: `aimsg-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      conversationId,
      role,
      content,
      model,
      createdAt: new Date().toISOString(),
    };

    const dbStatus = getLastDatabaseStatus();
    if (dbStatus.connected) {
      try {
        await executeQuery(
          `INSERT INTO ai_messages (id, conversation_id, role, content, model, created_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [msg.id, msg.conversationId, msg.role, msg.content, msg.model, msg.createdAt]
        );
        await executeQuery(
          `UPDATE ai_conversations SET updated_at = ? WHERE id = ?`,
          [msg.createdAt, conversationId]
        );
      } catch (err) {
        console.warn('MariaDB addMessage failed:', err);
      }
    }

    inMemoryMessages.push(msg);
    return msg;
  }

  async getMessages(conversationId: string): Promise<AiMessage[]> {
    const dbStatus = getLastDatabaseStatus();
    if (dbStatus.connected) {
      try {
        const rows = await executeQuery<any>(
          `SELECT id, conversation_id, role, content, model, created_at 
           FROM ai_messages WHERE conversation_id = ? ORDER BY created_at ASC`,
          [conversationId]
        );
        return rows.map((r) => ({
          id: r.id,
          conversationId: r.conversation_id,
          role: r.role,
          content: r.content,
          model: r.model,
          createdAt: r.created_at,
        }));
      } catch (err) {
        console.warn('MariaDB getMessages failed:', err);
      }
    }

    return inMemoryMessages.filter((m) => m.conversationId === conversationId);
  }
}

export const aiConversationRepository = new AiConversationRepository();
