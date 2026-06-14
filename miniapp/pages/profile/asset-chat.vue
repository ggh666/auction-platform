<template>
  <view class="page">
    <view class="chat-header">
      <text class="title">{{ conversationTitle }}</text>
      <text class="summary">{{ conversationSubtitle }}</text>
    </view>
    <scroll-view class="message-list" scroll-y>
      <view v-if="loading" class="empty">正在加载消息</view>
      <view v-else-if="messages.length === 0" class="empty">暂无消息</view>
      <view
        v-for="message in messages"
        :key="message.id"
        class="message-row"
        :class="{ mine: isMineMessage(message) }"
      >
        <text class="sender">{{ message.senderDisplayName }}</text>
        <text class="bubble">{{ message.content }}</text>
        <text class="time">{{ formatTime(message.createdAt) }}</text>
      </view>
    </scroll-view>
    <view class="composer">
      <input v-model="draft" class="message-input" maxlength="500" placeholder="请输入消息内容" />
      <button class="send-button" :loading="sending" :disabled="sending" @tap="sendMessage">发送</button>
    </view>
  </view>
</template>

<script setup lang="ts">
import type { AssetConversation, AssetMessage, AssetMessageWsEvent } from "@auction/shared";
import { onHide, onLoad, onShow, onUnload } from "@dcloudio/uni-app";
import { computed, ref } from "vue";
import {
  listAssetConversationMessages,
  listAssetConversations,
  readApiBase,
  sendAssetConversationMessage
} from "../../api/client";
import { readSessionUser } from "../../auth/session";
import { connectMessageSocket, type MessageSocketTask } from "../../utils/messageRealtime";
import { requestAssetMessageSubscription } from "../../utils/subscribeMessage";

const conversationId = ref("");
const conversation = ref<AssetConversation | null>(null);
const messages = ref<AssetMessage[]>([]);
const draft = ref("");
const currentUserId = ref("");
const loading = ref(false);
const sending = ref(false);
let socket: MessageSocketTask | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let messageRefreshTimer: ReturnType<typeof setInterval> | null = null;
let realtimeActive = false;
let refreshingMessages = false;

const conversationTitle = computed(() => conversation.value?.asset.title ?? "资产消息");
const conversationSubtitle = computed(() => {
  if (!conversation.value) {
    return "";
  }
  if (conversation.value.conversationType === "seller_contact") {
    if (conversation.value.targetUserId === currentUserId.value) {
      return `联系方：${conversation.value.user.displayName}`;
    }
    return `发布者：${conversation.value.targetUser?.displayName ?? "发布者"}`;
  }
  return conversation.value.principal ? `主理人：${conversation.value.principal.displayName}` : "与主理人沟通";
});

onLoad((query) => {
  const value = query?.conversationId;
  conversationId.value = typeof value === "string" ? value : "";
  void loadConversation();
});

onShow(() => {
  currentUserId.value = readSessionUser()?.id ?? currentUserId.value;
  void refreshConversationMessages();
  connectRealtime();
  startMessageRefreshPolling();
});

onHide(() => {
  stopMessageRefreshPolling();
  closeRealtime();
});

onUnload(() => {
  stopMessageRefreshPolling();
  closeRealtime();
});

async function loadConversation() {
  if (!conversationId.value) {
    uni.showToast({ title: "会话不存在", icon: "none" });
    return;
  }
  loading.value = true;
  try {
    const [conversationResponse, messageResponse] = await Promise.all([
      listAssetConversations(),
      listAssetConversationMessages(conversationId.value)
    ]);
    conversation.value = conversationResponse.items.find((item) => item.id === conversationId.value) ?? null;
    messages.value = messageResponse.items;
  } catch {
    uni.showToast({ title: "消息加载失败", icon: "none" });
  } finally {
    loading.value = false;
  }
}

async function refreshConversationMessages() {
  if (!conversationId.value || loading.value || refreshingMessages) {
    return;
  }
  refreshingMessages = true;
  try {
    const [conversationResponse, messageResponse] = await Promise.all([
      listAssetConversations(),
      listAssetConversationMessages(conversationId.value)
    ]);
    conversation.value = conversationResponse.items.find((item) => item.id === conversationId.value) ?? conversation.value;
    for (const message of messageResponse.items) {
      upsertMessage(message);
    }
  } catch {
    // Realtime refresh is a silent fallback; explicit page loading still shows failures.
  } finally {
    refreshingMessages = false;
  }
}

async function sendMessage() {
  const content = draft.value.trim();
  if (!content) {
    uni.showToast({ title: "请输入消息内容", icon: "none" });
    return;
  }
  sending.value = true;
  try {
    await requestAssetMessageSubscription();
    const response = await sendAssetConversationMessage(conversationId.value, content);
    conversation.value = response.conversation;
    upsertMessage(response.message);
    draft.value = "";
  } catch (error) {
    uni.showToast({ title: error instanceof Error && error.message.trim() ? error.message : "发送失败", icon: "none" });
  } finally {
    sending.value = false;
  }
}

function isMineMessage(message: AssetMessage): boolean {
  if (message.senderType === "admin") {
    return false;
  }
  return Boolean(currentUserId.value && message.senderUserId === currentUserId.value);
}

function connectRealtime() {
  realtimeActive = true;
  if (socket !== null) {
    return;
  }
  socket = connectMessageSocket({
    apiBase: readApiBase(),
    connectSocket(input) {
      return uni.connectSocket(input) as unknown as MessageSocketTask;
    },
    onEvent(event) {
      applyRealtimeEvent(event);
    },
    onClose() {
      handleRealtimeClose();
    },
    onError() {
      handleRealtimeError();
    },
    onOpen() {
      handleRealtimeOpen();
    }
  });
  if (socket === null) {
    scheduleReconnect();
  }
}

function handleRealtimeOpen() {
  void refreshConversationMessages();
}

function handleRealtimeClose() {
  socket = null;
  scheduleReconnect();
}

function handleRealtimeError() {
  socket?.close?.({});
  socket = null;
  void refreshConversationMessages();
  scheduleReconnect();
}

function scheduleReconnect() {
  if (!realtimeActive || reconnectTimer !== null) {
    return;
  }
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connectRealtime();
  }, 5000);
}

function startMessageRefreshPolling() {
  if (messageRefreshTimer !== null) {
    return;
  }
  messageRefreshTimer = setInterval(() => {
    void refreshConversationMessages();
  }, 3000);
}

function stopMessageRefreshPolling() {
  if (messageRefreshTimer === null) {
    return;
  }
  clearInterval(messageRefreshTimer);
  messageRefreshTimer = null;
}

function closeRealtime() {
  realtimeActive = false;
  if (reconnectTimer !== null) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  socket?.close?.({});
  socket = null;
}

function applyRealtimeEvent(event: AssetMessageWsEvent) {
  if (event.type === "asset_message_created") {
    if (event.conversationId === conversationId.value) {
      upsertMessage(event.message);
    }
    return;
  }
  if (event.type === "asset_conversation_updated") {
    if (event.conversation.id === conversationId.value) {
      conversation.value = event.conversation;
    }
  }
}

function upsertMessage(message: AssetMessage) {
  messages.value = [...messages.value.filter((item) => item.id !== message.id), message].sort(
    (left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime() || Number(left.id) - Number(right.id)
  );
}

function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}
</script>

<style scoped>
.page {
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  padding: 24rpx 24rpx calc(28rpx + env(safe-area-inset-bottom));
  background:
    linear-gradient(145deg, rgba(20, 184, 166, 0.16), transparent 34%),
    linear-gradient(26deg, rgba(246, 196, 83, 0.17), transparent 44%),
    #071112;
}

.title,
.summary,
.sender,
.bubble,
.time {
  display: block;
}

.chat-header {
  padding-bottom: 20rpx;
}

.title {
  font-size: 34rpx;
  font-weight: 800;
  color: #f7e8b6;
}

.summary {
  margin-top: 8rpx;
  color: #8aa196;
}

.message-list {
  flex: 1;
  min-height: 0;
}

.message-row {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  margin-bottom: 22rpx;
}

.message-row.mine {
  align-items: flex-end;
}

.sender {
  margin-bottom: 8rpx;
  font-size: 22rpx;
  color: #8aa196;
}

.bubble {
  max-width: 78%;
  padding: 18rpx 20rpx;
  line-height: 1.55;
  color: #ecfdf5;
  word-break: break-word;
  background: rgba(11, 32, 30, 0.96);
  border: 1px solid rgba(45, 212, 191, 0.22);
  border-radius: 8rpx;
}

.message-row.mine .bubble {
  color: #071112;
  background: #f6c453;
  border-color: #f6c453;
}

.time {
  margin-top: 6rpx;
  font-size: 22rpx;
  color: #667085;
}

.composer {
  display: grid;
  grid-template-columns: 1fr 128rpx;
  gap: 12rpx;
  padding-top: 18rpx;
}

.message-input {
  box-sizing: border-box;
  height: 72rpx;
  padding: 0 22rpx;
  color: #f7e8b6;
  background: rgba(11, 32, 30, 0.96);
  border: 1px solid rgba(246, 196, 83, 0.28);
  border-radius: 6rpx;
}

.send-button {
  height: 72rpx;
  margin: 0;
  font-size: 26rpx;
  font-weight: 800;
  line-height: 72rpx;
  color: #071112;
  background: #f6c453;
  border-radius: 6rpx;
}

.send-button::after {
  border: 0;
}

.empty {
  padding: 80rpx 0;
  text-align: center;
  color: #8aa196;
}
</style>
