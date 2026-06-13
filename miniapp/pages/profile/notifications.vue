<template>
  <view class="page">
    <view class="header">
      <view class="header-copy">
        <text class="title">通知中心</text>
        <text class="summary">通知 / 消息</text>
        <text v-if="activeTab === 'notifications' && unreadCount > 0" class="summary">{{ unreadCount }} 条未读通知</text>
        <text v-if="activeTab === 'messages' && conversationUnreadCount > 0" class="summary">{{ conversationUnreadCount }} 条未读消息</text>
      </view>
      <block v-if="unreadCount > 0">
        <button
          v-if="activeTab === 'notifications'"
          class="mark-all-button"
          :loading="markingAllRead"
          :disabled="markingAllRead"
          @tap.stop="markAllRead"
        >
          全部已读
        </button>
      </block>
    </view>
    <view class="tabs">
      <button class="tab-button" :class="{ active: activeTab === 'notifications' }" @tap="switchTab('notifications')">
        通知
      </button>
      <button class="tab-button" :class="{ active: activeTab === 'messages' }" @tap="switchTab('messages')">
        消息
      </button>
    </view>
    <view class="retention-notice">
      <text class="retention-title">消息留存免责声明</text>
      <text class="retention-copy">
        站内通知和消息仅保留3个月，历史消息会按规则定期删除；请及时查看，必要内容请自行留存。清理后的记录无法恢复，平台不承诺长期保存。
      </text>
    </view>
    <view v-if="hasActiveItems" class="manage-bar">
      <button class="manage-button" @tap="toggleManageMode">{{ selectionMode ? "取消" : "管理" }}</button>
      <block v-if="selectionMode">
        <button class="manage-button" @tap="toggleSelectAll">{{ allActiveSelected ? "取消全选" : "全选" }}</button>
        <button class="delete-button" :loading="deleting" :disabled="deleting || selectedCount === 0" @tap="deleteSelected">
          删除{{ selectedCount > 0 ? `(${selectedCount})` : "" }}
        </button>
      </block>
    </view>
    <block v-if="activeTab === 'notifications'">
      <view v-if="loading" class="empty">正在加载通知</view>
      <view v-else-if="notifications.length === 0" class="empty">暂无通知</view>
      <view
        v-for="notification in notifications"
        :key="notification.id"
        class="notification-row"
        :class="{ unread: !notification.readAt, selecting: selectionMode }"
        @tap="handleNotificationTap(notification)"
      >
        <view
          v-if="selectionMode"
          class="select-indicator"
          :class="{ checked: selectedNotificationIds.includes(notification.id) }"
          @tap.stop="toggleNotificationSelection(notification.id)"
        >
          <view class="select-dot"></view>
        </view>
        <view class="row-content">
          <text class="notification-title">{{ notification.assetTitle }}</text>
          <text class="notification-content">{{ notificationContent(notification) }}</text>
          <text class="notification-time">{{ formatTime(notification.createdAt) }}</text>
        </view>
      </view>
    </block>
    <block v-else>
      <view v-if="loadingConversations" class="empty">正在加载消息</view>
      <view v-else-if="conversations.length === 0" class="empty">暂无消息</view>
      <view
        v-for="conversation in conversations"
        :key="conversation.id"
        class="notification-row"
        :class="{ unread: conversation.userUnreadCount > 0, selecting: selectionMode }"
        @tap="handleConversationTap(conversation.id)"
      >
        <view
          v-if="selectionMode"
          class="select-indicator"
          :class="{ checked: selectedConversationIds.includes(conversation.id) }"
          @tap.stop="toggleConversationSelection(conversation.id)"
        >
          <view class="select-dot"></view>
        </view>
        <view class="row-content">
          <text class="notification-title">{{ conversation.asset.title }}</text>
          <text class="notification-content">
            {{ conversationSummary(conversation) }} / {{ conversation.lastMessageText ?? "暂无消息" }}
          </text>
          <text class="notification-time">{{ formatTime(conversation.lastMessageAt ?? conversation.updatedAt) }}</text>
        </view>
      </view>
    </block>
  </view>
</template>

<script setup lang="ts">
import { centsToYuanText, type AssetConversation, type NotificationItem } from "@auction/shared";
import { onShow } from "@dcloudio/uni-app";
import { computed, ref } from "vue";
import {
  deleteAssetConversations,
  deleteNotifications,
  listAssetConversations,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead
} from "../../api/client";
import { readSessionUser } from "../../auth/session";

const activeTab = ref<"notifications" | "messages">("notifications");
const loading = ref(false);
const loadingConversations = ref(false);
const markingAllRead = ref(false);
const deleting = ref(false);
const selectionMode = ref(false);
const notifications = ref<NotificationItem[]>([]);
const conversations = ref<AssetConversation[]>([]);
const selectedNotificationIds = ref<string[]>([]);
const selectedConversationIds = ref<string[]>([]);
const unreadCount = ref(0);
const conversationUnreadCount = ref(0);
const currentUserId = ref("");

const activeItemIds = computed(() =>
  activeTab.value === "notifications" ? notifications.value.map((item) => item.id) : conversations.value.map((item) => item.id)
);
const selectedIds = computed(() => (activeTab.value === "notifications" ? selectedNotificationIds.value : selectedConversationIds.value));
const selectedCount = computed(() => selectedIds.value.length);
const hasActiveItems = computed(() => activeItemIds.value.length > 0);
const allActiveSelected = computed(() => hasActiveItems.value && activeItemIds.value.every((id) => selectedIds.value.includes(id)));

onShow(() => {
  currentUserId.value = readSessionUser()?.id ?? "";
  void loadNotifications();
  void loadAssetConversations();
});

async function loadNotifications() {
  loading.value = true;
  try {
    const response = await listNotifications();
    notifications.value = response.items;
    unreadCount.value = response.unreadCount;
  } catch {
    notifications.value = [];
    unreadCount.value = 0;
    uni.showToast({ title: "通知加载失败", icon: "none" });
  } finally {
    loading.value = false;
  }
}

async function loadAssetConversations() {
  loadingConversations.value = true;
  try {
    const response = await listAssetConversations();
    conversations.value = response.items;
    conversationUnreadCount.value = response.unreadCount;
  } catch (error) {
    conversations.value = [];
    conversationUnreadCount.value = 0;
    if (isApiNotFound(error)) {
      return;
    }
    uni.showToast({ title: "消息加载失败", icon: "none" });
  } finally {
    loadingConversations.value = false;
  }
}

function isApiNotFound(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { statusCode?: unknown }).statusCode === 404;
}

async function markAllRead() {
  if (markingAllRead.value || unreadCount.value === 0) {
    return;
  }

  markingAllRead.value = true;
  try {
    const response = await markAllNotificationsRead();
    notifications.value = response.items;
    unreadCount.value = response.unreadCount;
    uni.showToast({ title: "已全部标为已读", icon: "none" });
  } catch {
    uni.showToast({ title: "标记失败，请稍后重试", icon: "none" });
  } finally {
    markingAllRead.value = false;
  }
}

function switchTab(tab: "notifications" | "messages") {
  activeTab.value = tab;
  clearSelection();
}

function toggleManageMode() {
  selectionMode.value = !selectionMode.value;
  if (!selectionMode.value) {
    clearSelection();
  }
}

function clearSelection() {
  selectionMode.value = false;
  selectedNotificationIds.value = [];
  selectedConversationIds.value = [];
}

function updateSelectedIds(target: "notifications" | "messages", ids: string[]) {
  if (target === "notifications") {
    selectedNotificationIds.value = ids;
  } else {
    selectedConversationIds.value = ids;
  }
}

function toggleId(target: "notifications" | "messages", id: string) {
  const current = target === "notifications" ? selectedNotificationIds.value : selectedConversationIds.value;
  updateSelectedIds(target, current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
}

function toggleNotificationSelection(notificationId: string) {
  toggleId("notifications", notificationId);
}

function toggleConversationSelection(conversationId: string) {
  toggleId("messages", conversationId);
}

function toggleSelectAll() {
  updateSelectedIds(activeTab.value, allActiveSelected.value ? [] : activeItemIds.value);
}

function confirmDeleteSelected(): Promise<boolean> {
  return new Promise((resolve) => {
    uni.showModal({
      title: "删除记录",
      content: `确认删除已选的 ${selectedCount.value} 条${activeTab.value === "notifications" ? "通知" : "消息"}？`,
      confirmText: "删除",
      cancelText: "取消",
      success(result) {
        resolve(Boolean(result.confirm));
      },
      fail() {
        resolve(false);
      }
    });
  });
}

async function deleteSelected() {
  if (deleting.value || selectedCount.value === 0) {
    return;
  }
  const confirmed = await confirmDeleteSelected();
  if (!confirmed) {
    return;
  }
  deleting.value = true;
  try {
    if (activeTab.value === "notifications") {
      const response = await deleteNotifications(selectedNotificationIds.value);
      notifications.value = response.items;
      unreadCount.value = response.unreadCount;
      selectedNotificationIds.value = [];
    } else {
      const response = await deleteAssetConversations(selectedConversationIds.value);
      conversations.value = response.items;
      conversationUnreadCount.value = response.unreadCount;
      selectedConversationIds.value = [];
    }
    selectionMode.value = false;
    uni.showToast({ title: "已删除", icon: "none" });
  } catch {
    uni.showToast({ title: "删除失败，请稍后重试", icon: "none" });
  } finally {
    deleting.value = false;
  }
}

async function openNotification(notification: NotificationItem) {
  if (!notification.readAt) {
    try {
      const response = await markNotificationRead(notification.id);
      notifications.value = notifications.value.map((item) => (item.id === notification.id ? response.notification : item));
      unreadCount.value = notifications.value.filter((item) => item.readAt === null).length;
    } catch {
      // Navigation is still useful even when read marking fails.
    }
  }
  uni.navigateTo({ url: `/pages/auctions/detail?assetId=${notification.assetId}` });
}

function openAssetConversation(conversationId: string) {
  uni.navigateTo({ url: `/pages/profile/asset-chat?conversationId=${conversationId}` });
}

function handleNotificationTap(notification: NotificationItem) {
  if (selectionMode.value) {
    toggleNotificationSelection(notification.id);
    return;
  }
  void openNotification(notification);
}

function handleConversationTap(conversationId: string) {
  if (selectionMode.value) {
    toggleConversationSelection(conversationId);
    return;
  }
  openAssetConversation(conversationId);
}

function conversationSummary(conversation: AssetConversation) {
  if (conversation.conversationType === "seller_contact") {
    if (conversation.targetUserId === currentUserId.value) {
      return `联系方：${conversation.user.displayName}`;
    }
    return `发布者：${conversation.targetUser?.displayName ?? "发布者"}`;
  }
  return `主理人：${conversation.principal?.displayName ?? "未绑定"}`;
}

function notificationContent(notification: NotificationItem) {
  if (notification.type !== "outbid") {
    return "成交状态有更新";
  }
  return `${notification.actorDisplayName} 已出价 ${formatPrice(notification.amountCents ?? 0)} 元`;
}

function formatPrice(cents: number) {
  return centsToYuanText(cents);
}

function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(
    2,
    "0"
  )} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}
</script>

<style scoped>
.page {
  padding: 24rpx;
}

.title,
.summary,
.header-copy,
.notification-title,
.notification-content,
.notification-time {
  display: block;
}

.header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20rpx;
  margin-bottom: 24rpx;
}

.header-copy {
  flex: 1;
  min-width: 0;
}

.title {
  margin-bottom: 10rpx;
  font-size: 36rpx;
  font-weight: 700;
  color: #101828;
}

.summary {
  color: #d92d20;
}

.mark-all-button {
  flex-shrink: 0;
  min-width: 156rpx;
  height: 64rpx;
  padding: 0 22rpx;
  margin: 0;
  font-size: 26rpx;
  font-weight: 700;
  line-height: 64rpx;
  color: #071112;
  background: #f6c453;
  border-radius: 6rpx;
}

.mark-all-button::after {
  border: 0;
}

.mark-all-button[disabled] {
  color: rgba(7, 17, 18, 0.68);
  background: rgba(246, 196, 83, 0.68);
}

.manage-bar {
  display: flex;
  gap: 12rpx;
  align-items: center;
  margin-bottom: 18rpx;
}

.manage-button,
.delete-button {
  height: 58rpx;
  padding: 0 22rpx;
  margin: 0;
  font-size: 24rpx;
  font-weight: 700;
  line-height: 58rpx;
  border-radius: 6rpx;
}

.manage-button {
  color: #f7e8b6;
  background: rgba(11, 32, 30, 0.96);
  border: 1px solid rgba(246, 196, 83, 0.28);
}

.delete-button {
  color: #071112;
  background: #f6c453;
}

.manage-button::after,
.delete-button::after {
  border: 0;
}

.delete-button[disabled] {
  color: rgba(7, 17, 18, 0.58);
  background: rgba(246, 196, 83, 0.54);
}

.tabs {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12rpx;
  margin-bottom: 18rpx;
  padding: 8rpx;
  background: rgba(7, 17, 18, 0.28);
  border: 1px solid rgba(246, 196, 83, 0.16);
  border-radius: 8rpx;
  box-shadow: inset 0 1rpx 0 rgba(255, 255, 255, 0.06);
}

.retention-notice {
  display: grid;
  gap: 8rpx;
  padding: 18rpx 20rpx;
  margin-bottom: 18rpx;
  background: rgba(11, 32, 30, 0.82);
  border: 1px solid rgba(246, 196, 83, 0.24);
  border-radius: 8rpx;
}

.retention-title,
.retention-copy {
  display: block;
}

.retention-title {
  font-size: 24rpx;
  font-weight: 800;
  line-height: 1.35;
  color: #f7e8b6;
}

.retention-copy {
  font-size: 22rpx;
  line-height: 1.6;
  color: #9ab4a8;
}

.tab-button {
  box-sizing: border-box;
  height: 60rpx;
  margin: 0;
  font-size: 26rpx;
  font-weight: 700;
  line-height: 60rpx;
  color: #d8e6dc;
  background: rgba(11, 32, 30, 0.92);
  border: 1px solid rgba(246, 196, 83, 0.24);
  border-radius: 6rpx;
  box-shadow: inset 0 1rpx 0 rgba(255, 255, 255, 0.08);
}

.tab-button::after {
  border: 0;
}

.tab-button:not(.active) {
  color: #d8e6dc;
  background: rgba(11, 32, 30, 0.92);
  border: 1px solid rgba(246, 196, 83, 0.24);
}

.tab-button.active {
  font-weight: 700;
  color: #071112;
  background: #f6c453;
  border-color: #f6c453;
  box-shadow: 0 8rpx 18rpx rgba(246, 196, 83, 0.22);
}

.notification-row {
  display: flex;
  gap: 18rpx;
  align-items: center;
  padding: 24rpx 0;
  border-bottom: 1px solid #eaecf0;
}

.notification-row.selecting {
  padding-left: 18rpx;
}

.row-content {
  flex: 1;
  min-width: 0;
}

.select-indicator {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 42rpx;
  height: 42rpx;
  border: 2rpx solid rgba(246, 196, 83, 0.42);
  border-radius: 50%;
}

.select-indicator.checked {
  background: #f6c453;
  border-color: #f6c453;
}

.select-dot {
  width: 16rpx;
  height: 16rpx;
  background: transparent;
  border-radius: 50%;
}

.select-indicator.checked .select-dot {
  background: #071112;
}

.notification-row.unread .notification-title::before {
  content: "";
  display: inline-block;
  width: 14rpx;
  height: 14rpx;
  margin-right: 12rpx;
  vertical-align: middle;
  background: #f04438;
  border-radius: 50%;
}

.notification-title {
  font-weight: 700;
  color: #101828;
}

.notification-content {
  margin-top: 8rpx;
  color: #667085;
}

.notification-time {
  margin-top: 8rpx;
  font-size: 24rpx;
  color: #98a2b3;
}

.empty {
  padding: 48rpx 0;
  text-align: center;
  color: #667085;
}

.page {
  min-height: 100vh;
  background:
    linear-gradient(145deg, rgba(20, 184, 166, 0.16), transparent 34%),
    linear-gradient(26deg, rgba(246, 196, 83, 0.17), transparent 44%),
    repeating-linear-gradient(90deg, rgba(245, 240, 220, 0.04) 0, rgba(245, 240, 220, 0.04) 1px, transparent 1px, transparent 46rpx),
    #071112;
}

.title {
  color: #f7e8b6;
  text-shadow: 0 4rpx 18rpx rgba(246, 196, 83, 0.22);
}

.summary {
  color: #ffd66b;
}

.notification-row {
  padding: 24rpx;
  margin-bottom: 14rpx;
  background: linear-gradient(145deg, rgba(16, 42, 38, 0.96), rgba(8, 19, 20, 0.98));
  border: 1px solid rgba(246, 196, 83, 0.22);
  border-radius: 10rpx;
  box-shadow: 0 12rpx 28rpx rgba(0, 0, 0, 0.24), inset 0 1rpx 0 rgba(255, 255, 255, 0.10);
}

.notification-row.selecting {
  padding-left: 18rpx;
}

.notification-row.unread {
  border-color: rgba(246, 196, 83, 0.44);
}

.notification-row.unread .notification-title::before {
  background: #f6c453;
  box-shadow: 0 0 16rpx rgba(246, 196, 83, 0.72);
}

.notification-title {
  color: #f7e8b6;
}

.notification-content,
.notification-time,
.empty {
  color: #9ab4a8;
}
</style>
