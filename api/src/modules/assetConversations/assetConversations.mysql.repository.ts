import type { AssetConversation, AssetConversationType, AssetMessage, AssetMessageSenderType, UserSummary } from "@auction/shared";
import { inTransaction } from "../../db/transaction";
import type { MysqlExecutor, MysqlPool, MysqlResultHeader } from "../../db/mysqlTypes";
import { allRows, firstRow, toIsoString } from "../../db/mysqlTypes";
import type {
  AdminConversationListInput,
  AssetConversationsRepository,
  ConversationPageInput,
  CreateMessageInput,
  CreatePrincipalConversationInput
} from "./assetConversations.repository";

type ConversationDbRow = {
  id: number;
  asset_id: number;
  conversation_type: AssetConversationType;
  user_id: number;
  principal_id: number | null;
  target_user_id: number | null;
  asset_title: string;
  asset_game_name: string;
  asset_server_name: string;
  asset_type: string;
  user_display_name: string;
  principal_display_name: string | null;
  target_user_display_name: string | null;
  last_message_text: string | null;
  last_message_at: Date | string | null;
  last_message_sender_type: AssetMessageSenderType | null;
  user_read_at: Date | string | null;
  admin_read_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
  user_unread_count?: number | string;
  admin_unread_count?: number | string;
};

type MessageDbRow = {
  id: number;
  conversation_id: number;
  sender_type: AssetMessageSenderType;
  sender_user_id: number | null;
  sender_admin_id: number | null;
  sender_display_name: string;
  content: string;
  created_at: Date | string;
};

const conversationSelect = `
  SELECT
    c.id,
    c.asset_id,
    c.conversation_type,
    c.user_id,
    c.principal_id,
    c.target_user_id,
    c.asset_title,
    c.asset_game_name,
    c.asset_server_name,
    c.asset_type,
    c.user_display_name,
    c.principal_display_name,
    c.target_user_display_name,
    c.last_message_text,
    c.last_message_at,
    c.last_message_sender_type,
    c.user_read_at,
    c.admin_read_at,
    c.created_at,
    c.updated_at,
    (
      SELECT COUNT(*)
      FROM asset_messages m
      WHERE m.conversation_id = c.id
        AND m.sender_type = 'admin'
        AND (c.user_read_at IS NULL OR m.created_at > c.user_read_at)
    ) AS user_unread_count,
    (
      SELECT COUNT(*)
      FROM asset_messages m
      WHERE m.conversation_id = c.id
        AND m.sender_type = 'user'
        AND (c.admin_read_at IS NULL OR m.created_at > c.admin_read_at)
    ) AS admin_unread_count
  FROM asset_conversations c
`;

const messageSelect = `
  SELECT id, conversation_id, sender_type, sender_user_id, sender_admin_id, sender_display_name, content, created_at
  FROM asset_messages
`;

function summaryFromStored(id: number | null, displayName: string | null): UserSummary | null {
  if (id === null || displayName === null) {
    return null;
  }
  return {
    id: String(id),
    displayName,
    banned: false,
    violationCount: 0,
    creditScore: 100,
    creditResetAt: null,
    buyerUnreachableCount: 0,
    bidRestrictedUntil: null,
    bidRestrictionPermanent: false,
    bidRestrictionReason: null,
    bidRestrictionStartedAt: null
  };
}

function toConversation(row: ConversationDbRow): AssetConversation {
  return {
    id: String(row.id),
    assetId: String(row.asset_id),
    conversationType: row.conversation_type,
    userId: String(row.user_id),
    principalId: row.principal_id === null ? null : String(row.principal_id),
    targetUserId: row.target_user_id === null ? null : String(row.target_user_id),
    asset: {
      id: String(row.asset_id),
      title: row.asset_title,
      gameName: row.asset_game_name,
      serverName: row.asset_server_name,
      assetType: row.asset_type
    },
    user: summaryFromStored(row.user_id, row.user_display_name) as UserSummary,
    principal:
      row.principal_id === null || row.principal_display_name === null
        ? null
        : { id: String(row.principal_id), displayName: row.principal_display_name },
    targetUser: summaryFromStored(row.target_user_id, row.target_user_display_name),
    lastMessageText: row.last_message_text,
    lastMessageAt: row.last_message_at === null ? null : toIsoString(row.last_message_at),
    lastMessageSenderType: row.last_message_sender_type,
    userUnreadCount: Number(row.user_unread_count ?? 0),
    adminUnreadCount: Number(row.admin_unread_count ?? 0),
    userReadAt: row.user_read_at === null ? null : toIsoString(row.user_read_at),
    adminReadAt: row.admin_read_at === null ? null : toIsoString(row.admin_read_at),
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at)
  };
}

function toMessage(row: MessageDbRow): AssetMessage {
  return {
    id: String(row.id),
    conversationId: String(row.conversation_id),
    senderType: row.sender_type,
    senderUserId: row.sender_user_id === null ? null : String(row.sender_user_id),
    senderAdminId: row.sender_admin_id === null ? null : String(row.sender_admin_id),
    senderDisplayName: row.sender_display_name,
    content: row.content,
    createdAt: toIsoString(row.created_at)
  };
}

function normalizePage(input: ConversationPageInput = {}) {
  const page = Number.isInteger(input.page) && input.page && input.page > 0 ? input.page : 1;
  const requestedPageSize = Number.isInteger(input.pageSize) && input.pageSize && input.pageSize > 0 ? input.pageSize : 20;
  return { page, pageSize: Math.min(requestedPageSize, 100) };
}

async function readConversation(db: MysqlExecutor, id: string): Promise<AssetConversation | null> {
  const [rows] = await db.execute<ConversationDbRow[]>(`${conversationSelect} WHERE c.id = ? LIMIT 1`, [Number(id)]);
  const row = firstRow<ConversationDbRow>(rows);
  return row ? toConversation(row) : null;
}

export function createMysqlAssetConversationsRepository(pool: MysqlPool): AssetConversationsRepository {
  async function listConversations(where: string, params: unknown[], input: ConversationPageInput = {}, unreadFor: "user" | "admin") {
    const { page, pageSize } = normalizePage(input);
    const [countRows] = await pool.execute<Array<{ total: number | string; unread_count: number | string }>>(
      `SELECT
         COUNT(*) AS total,
         COALESCE(SUM(
           ${
             unreadFor === "user"
               ? `(
             SELECT COUNT(*)
             FROM asset_messages m
             WHERE m.conversation_id = c.id
               AND m.sender_type = 'admin'
               AND (c.user_read_at IS NULL OR m.created_at > c.user_read_at)
           )`
               : `(
             SELECT COUNT(*)
             FROM asset_messages m
             WHERE m.conversation_id = c.id
               AND m.sender_type = 'user'
               AND (c.admin_read_at IS NULL OR m.created_at > c.admin_read_at)
           )`
           }
         ), 0) AS unread_count
       FROM asset_conversations c
       ${where}`,
      params
    );
    const countRow = firstRow<{ total: number | string; unread_count: number | string }>(countRows);
    const total = countRow ? Number(countRow.total) : 0;
    const unreadCount = countRow ? Number(countRow.unread_count) : 0;
    const [rows] = await pool.execute<ConversationDbRow[]>(
      `${conversationSelect}
       ${where}
       ORDER BY COALESCE(c.last_message_at, c.updated_at) DESC, c.id DESC
       LIMIT ? OFFSET ?`,
      [...params, pageSize, (page - 1) * pageSize]
    );
    return {
      items: allRows<ConversationDbRow>(rows).map(toConversation),
      total,
      page,
      pageSize,
      hasMore: page * pageSize < total,
      unreadCount
    };
  }

  return {
    async createOrGetPrincipalConversation(input: CreatePrincipalConversationInput) {
      const existing = await pool.execute<ConversationDbRow[]>(
        `${conversationSelect}
         WHERE c.conversation_type = 'principal_contact'
           AND c.asset_id = ?
           AND c.user_id = ?
           AND c.principal_id = ?
         LIMIT 1`,
        [Number(input.asset.id), Number(input.user.id), Number(input.principal.id)]
      );
      const existingRow = firstRow<ConversationDbRow>(existing[0]);
      if (existingRow) {
        return toConversation(existingRow);
      }

      const [result] = await pool.execute<MysqlResultHeader>(
        `INSERT INTO asset_conversations (
           asset_id,
           conversation_type,
           user_id,
           principal_id,
           asset_title,
           asset_game_name,
           asset_server_name,
           asset_type,
           user_display_name,
           principal_display_name,
           user_read_at,
           admin_read_at
         )
         VALUES (?, 'principal_contact', ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [
          Number(input.asset.id),
          Number(input.user.id),
          Number(input.principal.id),
          input.asset.title,
          input.asset.gameName,
          input.asset.serverName,
          input.asset.assetType,
          input.user.displayName,
          input.principal.displayName
        ]
      );
      const created = await readConversation(pool, String(result.insertId));
      if (!created) {
        throw new Error("Conversation could not be read");
      }
      return created;
    },

    async findById(id) {
      return readConversation(pool, id);
    },

    async listForUser(userId, input = {}) {
      return listConversations("WHERE c.user_id = ?", [Number(userId)], input, "user");
    },

    async listForAdmin(input: AdminConversationListInput = {}) {
      const where: string[] = [];
      const params: unknown[] = [];
      if (input.principalId) {
        where.push("c.principal_id = ?");
        params.push(Number(input.principalId));
      }
      if (input.type) {
        where.push("c.conversation_type = ?");
        params.push(input.type);
      }
      return listConversations(where.length > 0 ? `WHERE ${where.join(" AND ")}` : "", params, input, "admin");
    },

    async listMessages(conversationId, input = {}) {
      const { page, pageSize } = normalizePage(input);
      const [countRows] = await pool.execute<Array<{ total: number | string }>>(
        `SELECT COUNT(*) AS total FROM asset_messages WHERE conversation_id = ?`,
        [Number(conversationId)]
      );
      const total = Number(firstRow<{ total: number | string }>(countRows)?.total ?? 0);
      const [rows] = await pool.execute<MessageDbRow[]>(
        `${messageSelect}
         WHERE conversation_id = ?
         ORDER BY created_at ASC, id ASC
         LIMIT ? OFFSET ?`,
        [Number(conversationId), pageSize, (page - 1) * pageSize]
      );
      return {
        items: allRows<MessageDbRow>(rows).map(toMessage),
        total,
        page,
        pageSize,
        hasMore: page * pageSize < total
      };
    },

    async createMessage(input: CreateMessageInput) {
      return inTransaction(pool, async (connection) => {
        const conversation = await readConversation(connection, input.conversationId);
        if (!conversation) {
          throw new Error("Conversation not found");
        }
        const [messageResult] = await connection.execute<MysqlResultHeader>(
          `INSERT INTO asset_messages (
             conversation_id,
             sender_type,
             sender_user_id,
             sender_admin_id,
             sender_display_name,
             content
           )
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            Number(input.conversationId),
            input.senderType,
            input.senderUserId ? Number(input.senderUserId) : null,
            input.senderAdminId ? Number(input.senderAdminId) : null,
            input.senderDisplayName,
            input.content
          ]
        );
        await connection.execute<MysqlResultHeader>(
          `UPDATE asset_conversations
           SET last_message_text = ?,
               last_message_at = CURRENT_TIMESTAMP,
               last_message_sender_type = ?,
               user_read_at = CASE WHEN ? = 'user' THEN CURRENT_TIMESTAMP ELSE user_read_at END,
               admin_read_at = CASE WHEN ? = 'admin' THEN CURRENT_TIMESTAMP ELSE admin_read_at END
           WHERE id = ?`,
          [input.content, input.senderType, input.senderType, input.senderType, Number(input.conversationId)]
        );
        const updated = await readConversation(connection, input.conversationId);
        const [messageRows] = await connection.execute<MessageDbRow[]>(`${messageSelect} WHERE id = ? LIMIT 1`, [messageResult.insertId]);
        const messageRow = firstRow<MessageDbRow>(messageRows);
        if (!updated || !messageRow) {
          throw new Error("Message could not be read");
        }
        return { conversation: updated, message: toMessage(messageRow) };
      });
    },

    async markRead(conversationId, reader) {
      await pool.execute<MysqlResultHeader>(
        `UPDATE asset_conversations
         SET user_read_at = CASE WHEN ? = 'user' THEN CURRENT_TIMESTAMP ELSE user_read_at END,
             admin_read_at = CASE WHEN ? = 'admin' THEN CURRENT_TIMESTAMP ELSE admin_read_at END
         WHERE id = ?`,
        [reader, reader, Number(conversationId)]
      );
      return readConversation(pool, conversationId);
    }
  };
}
