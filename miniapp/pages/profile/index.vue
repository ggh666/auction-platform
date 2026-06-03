<template>
  <view class="page">
    <view class="page-header">
      <text class="title">个人中心</text>
      <button class="home-button" @tap="goHome">返回主页</button>
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
    <view class="menu-item" @tap="go('/pages/profile/follows')">
      <text class="menu-title">我的关注</text>
      <text class="menu-desc">查看关注过的交换信息</text>
    </view>
    <view class="menu-item" @tap="go('/pages/profile/bids')">
      <text class="menu-title">我的出价</text>
      <text class="menu-desc">跟踪参与过的交换和当前最高价</text>
    </view>
    <view class="menu-item" @tap="go('/pages/profile/notifications')">
      <view class="menu-title-row">
        <text class="menu-title">消息通知</text>
        <text v-if="unreadNotifications > 0" class="badge">{{ unreadNotifications }}</text>
      </view>
      <text class="menu-desc">查看参与交换后的新出价提醒</text>
    </view>
    <view class="menu-item" @tap="go('/pages/profile/results')">
      <text class="menu-title">成交记录</text>
      <text class="menu-desc">查看成交、流拍和取消记录</text>
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
import { getProfile, listNotifications } from "../../api/client";
import { clearSession, readSessionUser } from "../../auth/session";
import { buildProfileCustomerServiceContact } from "../../utils/customerService";

const user = ref<UserSummary | null>(readSessionUser());
const unreadNotifications = ref(0);

const avatarText = computed(() => user.value?.displayName?.slice(0, 1) || "微");
const profileCustomerServiceContact = computed(() => buildProfileCustomerServiceContact({ userId: user.value?.id }));

onShow(async () => {
  try {
    const response = await getProfile();
    user.value = response.user;
  } catch {
    clearSession();
    user.value = null;
    uni.showToast({ title: "请先登录", icon: "none" });
    uni.navigateTo({ url: "/pages/login/login" });
    return;
  }

  try {
    const notifications = await listNotifications();
    unreadNotifications.value = notifications.unreadCount;
  } catch {
    unreadNotifications.value = 0;
  }
});

function go(url: string) {
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
  uni.navigateTo({ url: "/pages/login/login" });
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
  uni.navigateTo({ url: "/pages/login/login" });
}
</script>

<style scoped>
.page {
  padding: 24rpx;
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

.home-button {
  flex: 0 0 auto;
  height: 56rpx;
  margin: 0;
  padding: 0 18rpx;
  font-size: 24rpx;
  line-height: 56rpx;
  color: #175cd3;
  background: #eff8ff;
  border-radius: 8rpx;
}

.home-button::after {
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

.menu-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.badge {
  min-width: 36rpx;
  height: 36rpx;
  padding: 0 10rpx;
  font-size: 22rpx;
  line-height: 36rpx;
  text-align: center;
  color: #fff;
  background: #d92d20;
  border-radius: 18rpx;
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

.home-button {
  color: #f7e8b6;
  font-weight: 800;
  background: rgba(11, 32, 30, 0.9);
  border: 1px solid rgba(246, 196, 83, 0.32);
}

.badge {
  background: linear-gradient(180deg, #fb7185, #b91c1c);
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
