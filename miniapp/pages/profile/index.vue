<template>
  <view class="page">
    <view class="page-header">
      <text class="title">个人中心</text>
      <view class="top-actions">
        <button class="notification-button" @tap="go('/pages/profile/notifications')">
          通知中心
          <text v-if="hasUnreadNotificationCenter" class="notification-dot"></text>
        </button>
        <button class="home-button" @tap="goHome">返回主页</button>
      </view>
    </view>
    <view class="profile-card">
      <image v-if="user?.avatarUrl" class="avatar" :src="user.avatarUrl" mode="aspectFill" />
      <view v-else class="avatar-fallback">{{ avatarText }}</view>
      <view class="profile-copy">
        <text class="display-name">{{ user?.displayName || "未登录" }}</text>
        <view class="summary-row">
          <text class="summary credit-summary">信誉分：{{ user?.creditScore ?? 100 }} 分</text>
          <button class="credit-help" @tap="showCreditRules">说明</button>
        </view>
        <text class="summary">违规记录：{{ user?.violationCount ?? 0 }} 条</text>
      </view>
    </view>
    <view v-if="!user" class="login-panel">
      <text class="login-title">登录后查看个人记录</text>
      <text class="login-copy">我的交换、消息中心和客服沟通需要登录后查看。</text>
      <button class="login-button" @tap="goLogin">立即登录</button>
    </view>
    <view class="menu-item" @tap="go('/pages/profile/exchanges')">
      <text class="menu-title">我的交换</text>
      <text class="menu-desc">查看我发布过的自由交换资源</text>
    </view>
    <button
      v-if="user"
      class="menu-item customer-service-menu"
      open-type="contact"
      :session-from="profileCustomerServiceContact.sessionFrom"
      :send-message-title="profileCustomerServiceContact.sendMessageTitle"
      :send-message-path="profileCustomerServiceContact.sendMessagePath"
      :send-message-img="profileCustomerServiceContact.sendMessageImg"
      :show-message-card="profileCustomerServiceContact.showMessageCard"
    >
      <text class="menu-title">联系客服</text>
      <text class="menu-desc">咨询交换规则与成交沟通</text>
    </button>
    <button v-else class="menu-item customer-service-menu" @tap="ensureCustomerServiceLogin">
      <text class="menu-title">联系客服</text>
      <text class="menu-desc">咨询交换规则与成交沟通</text>
    </button>
    <button class="logout" @tap="logout">退出登录</button>
  </view>
</template>

<script setup lang="ts">
import type { UserSummary } from "@auction/shared";
import { onShow } from "@dcloudio/uni-app";
import { computed, ref } from "vue";
import { getProfile, listAssetConversations, listNotifications } from "../../api/client";
import { clearSession, readSessionUser } from "../../auth/session";
import { loginUrlForRedirect } from "../../utils/authNavigation";
import { buildProfileCustomerServiceContact } from "../../utils/customerService";
import { syncCustomTabBarSelected } from "../../utils/tabBar";

const user = ref<UserSummary | null>(readSessionUser());
const unreadNotifications = ref(0);
const unreadConversations = ref(0);

const avatarText = computed(() => user.value?.displayName?.slice(0, 1) || "微");
const profileCustomerServiceContact = computed(() => buildProfileCustomerServiceContact({ userId: user.value?.id }));
const hasUnreadNotificationCenter = computed(() => unreadNotifications.value > 0 || unreadConversations.value > 0);

onShow(async () => {
  syncCustomTabBarSelected(1);
  try {
    const response = await getProfile();
    user.value = response.user;
  } catch {
    clearSession();
    user.value = null;
    return;
  }

  try {
    const notifications = await listNotifications();
    unreadNotifications.value = notifications.unreadCount;
  } catch {
    unreadNotifications.value = 0;
  }

  try {
    const conversations = await listAssetConversations({ pageSize: 1 });
    unreadConversations.value = conversations.unreadCount;
  } catch {
    unreadConversations.value = 0;
  }
});

function go(url: string) {
  if (!user.value) {
    uni.navigateTo({ url: loginUrlForRedirect(url) });
    return;
  }
  uni.navigateTo({ url });
}

function goHome() {
  uni.switchTab({ url: "/pages/games/index" });
}

function ensureCustomerServiceLogin() {
  if (user.value?.id) {
    return;
  }
  uni.showToast({ title: "请先登录后联系客服", icon: "none" });
  goLogin();
}

function showCreditRules() {
  uni.showModal({
    title: "信誉分规则",
    content:
      "信誉分默认 100 分。每次违规扣 5 分；70 分及以下只能浏览，不能关注或取消关注、出价、标记通知已读。扣分满 3 个月后会自动恢复为 100 分。",
    showCancel: false,
    confirmText: "我知道了"
  });
}

function logout() {
  clearSession();
  user.value = null;
  unreadNotifications.value = 0;
  unreadConversations.value = 0;
}

function goLogin() {
  uni.navigateTo({ url: loginUrlForRedirect("/pages/profile/index") });
}
</script>

<style scoped>
.page {
  box-sizing: border-box;
  padding: 24rpx 24rpx calc(180rpx + env(safe-area-inset-bottom));
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
}

.title,
.summary,
.menu-title,
.menu-desc {
  display: block;
}

.title {
  flex: 1;
  min-width: 0;
  font-size: 36rpx;
  font-weight: 700;
  color: #101828;
}

.top-actions {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: flex-end;
  gap: 12rpx;
}

.home-button,
.notification-button {
  flex: 0 0 auto;
  position: relative;
  height: 56rpx;
  margin: 0;
  padding: 0 18rpx;
  font-size: 24rpx;
  line-height: 56rpx;
  color: #175cd3;
  background: #eff8ff;
  border-radius: 8rpx;
}

.home-button::after,
.notification-button::after {
  border: 0;
}

.summary {
  margin-top: 8rpx;
  line-height: 1.6;
  color: #667085;
}

.summary-row {
  display: flex;
  align-items: center;
  gap: 12rpx;
  margin-top: 8rpx;
}

.summary-row .summary {
  margin-top: 0;
}

.credit-summary {
  flex: 0 1 auto;
}

.credit-help {
  flex: 0 0 auto;
  height: 42rpx;
  margin: 0;
  padding: 0 12rpx;
  font-size: 22rpx;
  line-height: 42rpx;
  color: #175cd3;
  background: #eff8ff;
  border-radius: 8rpx;
}

.credit-help::after {
  border: 0;
}

.profile-card {
  display: flex;
  align-items: center;
  padding: 24rpx;
  margin: 20rpx 0 24rpx;
  background: #f9fafb;
  border: 1px solid #eaecf0;
  border-radius: 8rpx;
}

.login-panel {
  display: grid;
  gap: 12rpx;
  padding: 24rpx;
  margin-bottom: 18rpx;
  background: rgba(11, 32, 30, 0.92);
  border: 1px solid rgba(246, 196, 83, 0.26);
  border-radius: 8rpx;
  box-shadow: 0 14rpx 32rpx rgba(0, 0, 0, 0.24);
}

.login-title,
.login-copy {
  display: block;
}

.login-title {
  font-size: 28rpx;
  font-weight: 800;
  color: #f7e8b6;
}

.login-copy {
  font-size: 24rpx;
  line-height: 1.55;
  color: #9ab4a8;
}

.login-button {
  width: 180rpx;
  height: 60rpx;
  margin: 6rpx 0 0;
  font-size: 24rpx;
  font-weight: 800;
  line-height: 60rpx;
  color: #071112;
  background: #f6c453;
  border-radius: 6rpx;
}

.login-button::after {
  border: 0;
}

.avatar,
.avatar-fallback {
  width: 112rpx;
  height: 112rpx;
  margin-right: 20rpx;
  border-radius: 56rpx;
}

.avatar-fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 40rpx;
  font-weight: 700;
  color: #175cd3;
  background: #eef4ff;
}

.profile-copy {
  flex: 1;
  min-width: 0;
}

.display-name {
  display: block;
  font-size: 32rpx;
  font-weight: 700;
  color: #101828;
}

.menu-item {
  padding: 24rpx 0;
  border-bottom: 1px solid #eaecf0;
}

.customer-service-menu {
  width: 100%;
  margin-right: 0;
  margin-left: 0;
  line-height: normal;
  text-align: left;
}

.customer-service-menu::after {
  border: 0;
}

.menu-title {
  font-weight: 700;
  color: #101828;
}

.notification-dot {
  position: absolute;
  top: -8rpx;
  right: -8rpx;
  width: 18rpx;
  height: 18rpx;
  background: #ef4444;
  border: 4rpx solid #071112;
  border-radius: 999rpx;
}

.menu-desc {
  margin-top: 8rpx;
  line-height: 1.5;
  color: #667085;
}

.logout {
  margin-top: 32rpx;
}

.page {
  min-height: 100vh;
  background:
    linear-gradient(145deg, rgba(20, 184, 166, 0.18), transparent 34%),
    linear-gradient(26deg, rgba(246, 196, 83, 0.18), transparent 44%),
    repeating-linear-gradient(90deg, rgba(245, 240, 220, 0.04) 0, rgba(245, 240, 220, 0.04) 1px, transparent 1px, transparent 46rpx),
    #071112;
}

.title {
  color: #f7e8b6;
  text-shadow: 0 4rpx 18rpx rgba(246, 196, 83, 0.22);
}

.profile-card,
.menu-item {
  background: linear-gradient(145deg, rgba(16, 42, 38, 0.96), rgba(8, 19, 20, 0.98));
  border: 1px solid rgba(246, 196, 83, 0.24);
  border-radius: 10rpx;
  box-shadow: 0 14rpx 32rpx rgba(0, 0, 0, 0.26), inset 0 1rpx 0 rgba(255, 255, 255, 0.10);
}

.menu-item {
  padding: 24rpx;
  margin-bottom: 14rpx;
}

.display-name,
.menu-title {
  color: #f7e8b6;
}

.summary,
.menu-desc {
  color: #9ab4a8;
}

.avatar-fallback {
  color: #1b1305;
  background: linear-gradient(180deg, #ffe08a, #d99620);
  box-shadow: 0 10rpx 24rpx rgba(246, 196, 83, 0.24);
}

.credit-help {
  color: #10201d;
  font-weight: 800;
  background: linear-gradient(180deg, #a7f3d0, #34d399);
}

.home-button,
.notification-button {
  color: #f7e8b6;
  font-weight: 800;
  background: rgba(11, 32, 30, 0.9);
  border: 1px solid rgba(246, 196, 83, 0.32);
}

.notification-dot {
  background: linear-gradient(180deg, #fb7185, #dc2626);
  box-shadow: 0 0 0 4rpx rgba(239, 68, 68, 0.18);
}

.logout {
  color: #f7e8b6;
  background: rgba(11, 32, 30, 0.9);
  border: 1px solid rgba(246, 196, 83, 0.32);
}

.logout::after {
  border: 0;
}
</style>
