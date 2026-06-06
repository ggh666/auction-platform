import { useEffect, useMemo, useState } from "react";
import type {
  AdminAssetConversationListResponse,
  AdminPrincipalListResponse,
  AdminRole,
  AssetConversation,
  AssetConversationMessageResponse,
  AssetConversationMessagesResponse,
  AssetMessage
} from "@auction/shared";
import { adminGet, adminPost } from "../api/client";
import { connectAdminMessageSocket, type AdminMessageSocket } from "../utils/messageRealtime";

type MessageCenterPageProps = {
  role: AdminRole;
};

export function MessageCenterPage({ role }: MessageCenterPageProps) {
  const [conversations, setConversations] = useState<AssetConversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<AssetMessage[]>([]);
  const [principals, setPrincipals] = useState<Array<{ id: string; displayName: string }>>([]);
  const [principalId, setPrincipalId] = useState("");
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const selectedConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === selectedId) ?? null,
    [conversations, selectedId]
  );

  useEffect(() => {
    void loadConversations();
  }, [principalId]);

  useEffect(() => {
    if (!selectedId) {
      setMessages([]);
      return;
    }
    void loadMessages(selectedId);
  }, [selectedId]);

  useEffect(() => {
    if (role !== "super_admin") {
      return;
    }
    void loadPrincipals();
  }, [role]);

  useEffect(() => {
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let socket: AdminMessageSocket | null = null;
    function connect() {
      socket = connectAdminMessageSocket({
        onEvent(event) {
          if (event.type === "asset_conversation_updated") {
            upsertConversation(event.conversation);
          }
          if (event.type === "asset_message_created" && event.conversationId === selectedId) {
            upsertMessage(event.message);
          }
        },
        onClose() {
          reconnectTimer = setTimeout(connect, 5000);
        },
        onError() {
          reconnectTimer = setTimeout(connect, 5000);
        }
      });
    }
    connect();
    return () => {
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
      }
      socket?.close();
    };
  }, [selectedId]);

  async function loadPrincipals() {
    try {
      const response = await adminGet<AdminPrincipalListResponse>("/admin/principals?pageSize=100");
      setPrincipals(response.items.map((principal) => ({ id: principal.id, displayName: principal.displayName })));
    } catch {
      setPrincipals([]);
    }
  }

  async function loadConversations() {
    setLoading(true);
    setError("");
    try {
      const query = role === "super_admin" && principalId ? `?principalId=${encodeURIComponent(principalId)}` : "";
      const response = await adminGet<AdminAssetConversationListResponse>(`/admin/asset-conversations${query}`);
      setConversations(response.items);
      setSelectedId((current) =>
        current && response.items.some((item) => item.id === current) ? current : response.items[0]?.id ?? null
      );
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "加载消息失败");
      setConversations([]);
    } finally {
      setLoading(false);
    }
  }

  async function selectConversation(conversationId: string) {
    setSelectedId(conversationId);
  }

  async function loadMessages(conversationId: string) {
    setError("");
    try {
      const response = await adminGet<AssetConversationMessagesResponse>(
        `/admin/asset-conversations/${conversationId}/messages?pageSize=100`
      );
      setMessages(response.items);
      setConversations((items) =>
        items.map((item) => (item.id === conversationId ? { ...item, adminUnreadCount: 0 } : item))
      );
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "加载会话失败");
      setMessages([]);
    }
  }

  async function sendMessage() {
    const content = draft.trim();
    if (!selectedId || !content) {
      return;
    }
    setSending(true);
    setError("");
    try {
      const response = await adminPost<AssetConversationMessageResponse>(`/admin/asset-conversations/${selectedId}/messages`, {
        content
      });
      upsertConversation(response.conversation);
      upsertMessage(response.message);
      setDraft("");
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "发送消息失败");
    } finally {
      setSending(false);
    }
  }

  function upsertConversation(conversation: AssetConversation) {
    setConversations((items) => [conversation, ...items.filter((item) => item.id !== conversation.id)]);
  }

  function upsertMessage(message: AssetMessage) {
    setMessages((items) =>
      [...items.filter((item) => item.id !== message.id), message].sort(
        (left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime() || Number(left.id) - Number(right.id)
      )
    );
  }

  return (
    <section className="message-center">
      <div className="section-heading">
        <div>
          <p className="eyebrow">消息中心</p>
          <h3>资产会话</h3>
          <p>普通主理人账号只显示自己负责的会话，超级管理员可筛选主理人。</p>
        </div>
        {role === "super_admin" ? (
          <label className="filter-control">
            <span>筛选主理人</span>
            <select value={principalId} onChange={(event) => setPrincipalId(event.target.value)}>
              <option value="">全部主理人</option>
              {principals.map((principal) => (
                <option key={principal.id} value={principal.id}>
                  {principal.displayName}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>
      {error ? <p className="error-banner">{error}</p> : null}
      <div className="message-layout">
        <aside className="conversation-list">
          {loading ? <p className="muted">正在加载消息</p> : null}
          {!loading && conversations.length === 0 ? <p className="muted">暂无会话</p> : null}
          {conversations.map((conversation) => (
            <button
              className={`conversation-item${conversation.id === selectedId ? " active" : ""}`}
              key={conversation.id}
              onClick={() => void selectConversation(conversation.id)}
              type="button"
            >
              <strong>{conversation.asset.title}</strong>
              <span>{conversation.user.displayName} / {conversation.principal?.displayName ?? "未绑定主理人"}</span>
              <small>{conversation.lastMessageText ?? "暂无消息"}</small>
              {conversation.adminUnreadCount > 0 ? <em>{conversation.adminUnreadCount}</em> : null}
            </button>
          ))}
        </aside>
        <div className="chat-panel">
          {selectedConversation ? (
            <>
              <div className="chat-title">
                <strong>{selectedConversation.asset.title}</strong>
                <span>{selectedConversation.user.displayName} 与 {selectedConversation.principal?.displayName ?? "主理人"}</span>
              </div>
              <div className="chat-messages">
                {messages.length === 0 ? <p className="muted">选择会话后显示历史消息</p> : null}
                {messages.map((message) => (
                  <div className={`chat-message ${message.senderType}`} key={message.id}>
                    <span>{message.senderDisplayName}</span>
                    <p>{message.content}</p>
                  </div>
                ))}
              </div>
              <div className="chat-composer">
                <textarea
                  maxLength={500}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder="输入文本消息"
                  value={draft}
                />
                <button className="primary-button" disabled={sending || !draft.trim()} onClick={() => void sendMessage()} type="button">
                  发送消息
                </button>
              </div>
            </>
          ) : (
            <p className="muted">请选择左侧会话</p>
          )}
        </div>
      </div>
    </section>
  );
}
