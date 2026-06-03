<template>
  <view class="page">
    <view class="header">
      <view class="header-copy">
        <text class="title">消息通知</text>
        <text v-if="unreadCount > 0" class="summary">{{ unreadCount }} 条未读通知</text>
      </view>
      <button
        v-if="unreadCount > 0"
        class="mark-all-button"
        :loading="markingAllRead"
        :disabled="markingAllRead"
        @tap.stop="markAllRead"
      >
        全部已读
      </button>
    </view>
    <view v-if="loading" class="empty">正在加载通知</view>
    <view v-else-if="notifications.length === 0" class="empty">暂无通知</view>
    <view
      v-for="notification in notifications"
      :key="notification.id"
      class="notification-row"
      :class="{ unread: !notification.readAt }"
      @tap="openNotification(notification)"
    >
      <text class="notification-title">{{ notification.assetTitle }}</text>
      <text class="notification-content">{{ notificationContent(notification) }}</text>
      <text class="notification-time">{{ formatTime(notification.createdAt) }}</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { centsToYuanText, type NotificationItem } from "@auction/shared";
import { onShow } from "@dcloudio/uni-app";
import { ref } from "vue";
import { listNotifications, markAllNotificationsRead, markNotificationRead } from "../../api/client";

const loading = ref(false);
const markingAllRead = ref(false);
const notifications = ref<NotificationItem[]>([]);
const unreadCount = ref(0);

onShow(() => {
  void loadNotifications();
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

.notification-row {
  padding: 24rpx 0;
  border-bottom: 1px solid #eaecf0;
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
