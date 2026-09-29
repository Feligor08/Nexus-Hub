import { randomUUID } from 'crypto';
import { executeQuery, getLastDatabaseStatus } from '../config/database';
import { AiConversation, AiMessage } from '../models/types';

export class AiConversationRepository {
  async createConversation(userId: string, title: string, roleId: string = 'general'): Promise<AiConversation> {
    if (!getLastDatabaseStatus().connected) {
      throw new Error('MariaDB ist nicht erreichbar. AI-Konversationen können nicht gespeichert werden.');
    }
    const conv: AiConversation = {
      id: `conv-${randomUUID()}`,
      userId,
      title,
      role: roleId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await executeQuery(
      `INSERT INTO ai_conversations (id, user_id, title, role_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [conv.id, conv.userId, conv.title, conv.role, conv.createdAt, conv.updatedAt]
    );
    return conv;
  }

  async getConversations(userId: string): Promise<AiConversation[]> {
    if (!getLastDatabaseStatus().connected) {
      throw new Error('MariaDB ist nicht erreichbar. AI-Konversationen sind derzeit nicht verfügbar.');
    }
    const rows = await executeQuery<any>(
      `SELECT id, user_id, title, role_id as role, created_at, updated_at
       FROM ai_conversations WHERE user_id = ? ORDER BY updated_at DESC LIMIT 30`,
      [userId]
    );
    return rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      title: row.title,
      role: row.role,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  async addMessage(conversationId: string, role: 'user' | 'assistant' | 'system', content: string, model: string = 'gemini-3.5-flash'): Promise<AiMessage> {
    if (!getLastDatabaseStatus().connected) {
      throw new Error('MariaDB ist nicht erreichbar. AI-Nachrichten können nicht gespeichert werden.');
    }
    const msg: AiMessage = {
      id: `aimsg-${randomUUID()}`,
      conversationId,
      role,
      content,
      model,
      createdAt: new Date().toISOString(),
    };

    await executeQuery(
      `INSERT INTO ai_messages (id, conversation_id, role, content, model, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [msg.id, msg.conversationId, msg.role, msg.content, msg.model, msg.createdAt]
    );
    await executeQuery(`UPDATE ai_conversations SET updated_at = ? WHERE id = ?`, [msg.createdAt, conversationId]);
    return msg;
  }

  async getMessages(conversationId: string): Promise<AiMessage[]> {
    if (!getLastDatabaseStatus().connected) {
      throw new Error('MariaDB ist nicht erreichbar. AI-Nachrichten sind derzeit nicht verfügbar.');
    }
    const rows = await executeQuery<any>(
      `SELECT id, conversation_id, role, content, model, created_at
       FROM ai_messages WHERE conversation_id = ? ORDER BY created_at ASC`,
      [conversationId]
    );
    return rows.map((row) => ({
      id: row.id,
      conversationId: row.conversation_id,
      role: row.role,
      content: row.content,
      model: row.model,
      createdAt: row.created_at,
    }));
  }
}

export const aiConversationRepository = new AiConversationRepository();
