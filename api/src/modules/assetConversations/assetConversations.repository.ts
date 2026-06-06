import type {
  AssetConversation,
  AssetConversationType,
  AssetMessage,
  AssetMessageSenderType,
  AuctionAsset,
  PrincipalSummary,
  UserSummary
} from "@auction/shared";

export type ConversationPageInput = {
  page?: number;
  pageSize?: number;
};

export type AdminConversationListInput = ConversationPageInput & {
  principalId?: string;
  type?: AssetConversationType;
};

export type ConversationListResult = {
  items: AssetConversation[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
  unreadCount: number;
};

export type ConversationMessagesResult = {
  items: AssetMessage[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
};

export type CreatePrincipalConversationInput = {
  asset: Pick<AuctionAsset, "id" | "title" | "gameName" | "serverName" | "assetType">;
  user: UserSummary;
  principal: PrincipalSummary;
};

export type CreateMessageInput = {
  conversationId: string;
  senderType: AssetMessageSenderType;
  senderUserId?: string | null;
  senderAdminId?: string | null;
  senderDisplayName: string;
  content: string;
};

export type AssetConversationsRepository = {
  createOrGetPrincipalConversation(input: CreatePrincipalConversationInput): Promise<AssetConversation>;
  findById(id: string): Promise<AssetConversation | null>;
  listForUser(userId: string, input?: ConversationPageInput): Promise<ConversationListResult>;
  listForAdmin(input?: AdminConversationListInput): Promise<ConversationListResult>;
  listMessages(conversationId: string, input?: ConversationPageInput): Promise<ConversationMessagesResult>;
  createMessage(input: CreateMessageInput): Promise<{ conversation: AssetConversation; message: AssetMessage }>;
  markRead(conversationId: string, reader: "user" | "admin"): Promise<AssetConversation | null>;
};

function normalizePage(input: ConversationPageInput = {}) {
  const page = Number.isInteger(input.page) && input.page && input.page > 0 ? input.page : 1;
  const requestedPageSize = Number.isInteger(input.pageSize) && input.pageSize && input.pageSize > 0 ? input.pageSize : 20;
  return { page, pageSize: Math.min(requestedPageSize, 100) };
}

function pageItems<T>(items: T[], input: ConversationPageInput = {}) {
  const { page, pageSize } = normalizePage(input);
  const offset = (page - 1) * pageSize;
  return {
    items: items.slice(offset, offset + pageSize),
    total: items.length,
    page,
    pageSize,
    hasMore: page * pageSize < items.length
  };
}

function isAfterRead(message: AssetMessage, readAt: string | null): boolean {
  if (!readAt) {
    return true;
  }
  return new Date(message.createdAt).getTime() > new Date(readAt).getTime();
}

function conversationSortValue(conversation: AssetConversation): number {
  return new Date(conversation.lastMessageAt ?? conversation.updatedAt ?? conversation.createdAt).getTime();
}

function sortConversations(items: AssetConversation[]): AssetConversation[] {
  return [...items].sort((left, right) => conversationSortValue(right) - conversationSortValue(left) || Number(right.id) - Number(left.id));
}

function cloneMessage(message: AssetMessage): AssetMessage {
  return { ...message };
}

function cloneConversation(conversation: AssetConversation): AssetConversation {
  return {
    ...conversation,
    asset: { ...conversation.asset },
    user: { ...conversation.user },
    principal: conversation.principal ? { ...conversation.principal } : null,
    targetUser: conversation.targetUser ? { ...conversation.targetUser } : null
  };
}

export function createInMemoryAssetConversationsRepository(
  options: { now?: () => Date } = {}
): AssetConversationsRepository {
  const now = options.now ?? (() => new Date());
  const conversations = new Map<string, AssetConversation>();
  const messages = new Map<string, AssetMessage[]>();
  let nextConversationId = 1;
  let nextMessageId = 1;

  function messagesFor(conversationId: string): AssetMessage[] {
    return messages.get(conversationId) ?? [];
  }

  function withUnreadCounts(conversation: AssetConversation): AssetConversation {
    const conversationMessages = messagesFor(conversation.id);
    const userUnreadCount = conversationMessages.filter(
      (message) => message.senderType === "admin" && isAfterRead(message, conversation.userReadAt)
    ).length;
    const adminUnreadCount = conversationMessages.filter(
      (message) => message.senderType === "user" && isAfterRead(message, conversation.adminReadAt)
    ).length;
    return { ...conversation, userUnreadCount, adminUnreadCount };
  }

  function readConversation(id: string): AssetConversation | null {
    const conversation = conversations.get(id);
    return conversation ? cloneConversation(withUnreadCounts(conversation)) : null;
  }

  function saveConversation(conversation: AssetConversation): AssetConversation {
    conversations.set(conversation.id, cloneConversation(conversation));
    return cloneConversation(withUnreadCounts(conversation));
  }

  return {
    async createOrGetPrincipalConversation(input) {
      const existing = [...conversations.values()].find(
        (conversation) =>
          conversation.conversationType === "principal_contact" &&
          conversation.assetId === input.asset.id &&
          conversation.userId === input.user.id &&
          conversation.principalId === input.principal.id
      );
      if (existing) {
        return cloneConversation(withUnreadCounts(existing));
      }

      const timestamp = now().toISOString();
      const conversation: AssetConversation = {
        id: String(nextConversationId++),
        assetId: input.asset.id,
        conversationType: "principal_contact",
        userId: input.user.id,
        principalId: input.principal.id,
        targetUserId: null,
        asset: { ...input.asset },
        user: { ...input.user },
        principal: { ...input.principal },
        targetUser: null,
        lastMessageText: null,
        lastMessageAt: null,
        lastMessageSenderType: null,
        userUnreadCount: 0,
        adminUnreadCount: 0,
        userReadAt: timestamp,
        adminReadAt: timestamp,
        createdAt: timestamp,
        updatedAt: timestamp
      };
      messages.set(conversation.id, []);
      return saveConversation(conversation);
    },

    async findById(id) {
      return readConversation(id);
    },

    async listForUser(userId, input = {}) {
      const filtered = sortConversations(
        [...conversations.values()].filter((conversation) => conversation.userId === userId).map(withUnreadCounts)
      );
      const page = pageItems(filtered.map(cloneConversation), input);
      return {
        ...page,
        unreadCount: filtered.reduce((sum, conversation) => sum + conversation.userUnreadCount, 0)
      };
    },

    async listForAdmin(input = {}) {
      const filtered = sortConversations(
        [...conversations.values()]
          .filter((conversation) => !input.principalId || conversation.principalId === input.principalId)
          .filter((conversation) => !input.type || conversation.conversationType === input.type)
          .map(withUnreadCounts)
      );
      const page = pageItems(filtered.map(cloneConversation), input);
      return {
        ...page,
        unreadCount: filtered.reduce((sum, conversation) => sum + conversation.adminUnreadCount, 0)
      };
    },

    async listMessages(conversationId, input = {}) {
      const sorted = [...messagesFor(conversationId)].sort(
        (left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime() || Number(left.id) - Number(right.id)
      );
      const page = pageItems(sorted.map(cloneMessage), input);
      return page;
    },

    async createMessage(input) {
      const conversation = conversations.get(input.conversationId);
      if (!conversation) {
        throw new Error("Conversation not found");
      }
      const timestamp = now().toISOString();
      const message: AssetMessage = {
        id: String(nextMessageId++),
        conversationId: input.conversationId,
        senderType: input.senderType,
        senderUserId: input.senderUserId ?? null,
        senderAdminId: input.senderAdminId ?? null,
        senderDisplayName: input.senderDisplayName,
        content: input.content,
        createdAt: timestamp
      };
      const updated: AssetConversation = {
        ...conversation,
        lastMessageText: input.content,
        lastMessageAt: timestamp,
        lastMessageSenderType: input.senderType,
        userReadAt: input.senderType === "user" ? timestamp : conversation.userReadAt,
        adminReadAt: input.senderType === "admin" ? timestamp : conversation.adminReadAt,
        updatedAt: timestamp
      };
      messages.set(input.conversationId, [...messagesFor(input.conversationId), cloneMessage(message)]);
      const saved = saveConversation(updated);
      return { conversation: saved, message: cloneMessage(message) };
    },

    async markRead(conversationId, reader) {
      const conversation = conversations.get(conversationId);
      if (!conversation) {
        return null;
      }
      const timestamp = now().toISOString();
      return saveConversation({
        ...conversation,
        userReadAt: reader === "user" ? timestamp : conversation.userReadAt,
        adminReadAt: reader === "admin" ? timestamp : conversation.adminReadAt,
        updatedAt: conversation.updatedAt
      });
    }
  };
}
