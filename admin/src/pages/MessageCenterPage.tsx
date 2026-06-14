import { useEffect, useMemo, useRef, useState } from "react";
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

function formatMessageTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day} ${hour}:${minute}`;
}

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
  const selectedIdRef = useRef<string | null>(null);
  const principalIdRef = useRef("");

  const selectedConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === selectedId) ?? null,
    [conversations, selectedId]
  );

  useEffect(() => {
    void loadConversations();
  }, [principalId]);

  useEffect(() => {
    selectedIdRef.current = selectedId;
    if (!selectedId) {
      setMessages([]);
      return;
    }
    void loadMessages(selectedId);
  }, [selectedId]);

  useEffect(() => {
    principalIdRef.current = principalId;
  }, [principalId]);

  useEffect(() => {
    if (role !== "super_admin") {
      return;
    }
    void loadPrincipals();
  }, [role]);

  useEffect(() => {
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let socket: AdminMessageSocket | null = null;
    let active = true;
    function scheduleReconnect() {
      if (!active || reconnectTimer !== null) {
        return;
      }
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        connect();
      }, 5000);
    }
    function connect() {
      if (!active) {
        return;
      }
      socket = connectAdminMessageSocket({
        onEvent(event) {
          if (event.type === "asset_conversation_updated") {
            if (shouldDisplayRealtimeConversation(event.conversation)) {
              upsertConversation(event.conversation);
              if (event.conversation.id === selectedIdRef.current) {
                void loadMessages(event.conversation.id);
              }
            }
          }
          if (event.type === "asset_message_created" && event.conversationId === selectedIdRef.current) {
            upsertMessage(event.message);
          }
        },
        onClose() {
          scheduleReconnect();
        },
        onError() {
          scheduleReconnect();
        }
      });
    }
    connect();
    return () => {
      active = false;
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
      }
      socket?.close();
    };
  }, [role]);

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

  function shouldDisplayRealtimeConversation(conversation: AssetConversation) {
    const filteredPrincipalId = principalIdRef.current;
    return role !== "super_admin" || !filteredPrincipalId || conversation.principalId === filteredPrincipalId;
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
                    <div className="message-meta">
                      <span>{message.senderDisplayName}</span>
                      <time
                        className="message-time"
                        dateTime={message.createdAt}
                        title={`发送时间：${formatMessageTime(message.createdAt)}`}
                      >
                        {formatMessageTime(message.createdAt)}
                      </time>
                    </div>
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
