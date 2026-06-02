<template>
  <view class="page">
    <view class="header">
      <view>
        <text class="title">选择资源</text>
        <text class="subtitle">选择后进入对应资产交换区</text>
      </view>
      <button class="share-button" open-type="share">分享</button>
    </view>

    <view v-if="unreadNotifications > 0" class="notice" @tap="openNotifications">
      <text class="notice-title">你有 {{ unreadNotifications }} 条未读价格变动提醒</text>
      <text class="notice-action">查看</text>
    </view>

    <view class="game-card" @tap="openGame('塔防精灵')">
      <view class="game-mark">塔</view>
      <view class="game-copy">
        <text class="game-title">塔防精灵</text>
        <text class="game-desc">账号与道具交换</text>
      </view>
      <text class="game-action">进入</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { onShareAppMessage, onShareTimeline, onShow } from "@dcloudio/uni-app";
import { ref } from "vue";
import { listNotifications } from "../../api/client";
import { readToken } from "../../auth/session";
import { buildHomeShare, toTimelineShare } from "../../utils/share";

const unreadNotifications = ref(0);

onShow(() => {
  uni.showShareMenu({ withShareTicket: true, menus: ["shareAppMessage", "shareTimeline"] });
  void refreshUnreadNotifications();
});

onShareAppMessage(() => buildHomeShare());

onShareTimeline(() => toTimelineShare(buildHomeShare()));

async function refreshUnreadNotifications() {
  if (!readToken()) {
    unreadNotifications.value = 0;
    return;
  }

  try {
    const response = await listNotifications();
    unreadNotifications.value = response.unreadCount;
  } catch {
    unreadNotifications.value = 0;
  }
}

function openGame(gameName: string) {
  uni.navigateTo({ url: `/pages/auctions/list?gameName=${encodeURIComponent(gameName)}` });
}

function openNotifications() {
  uni.navigateTo({ url: "/pages/profile/notifications" });
}
</script>

<style scoped>
.page {
  min-height: 100vh;
  padding: 32rpx 24rpx;
  background: #f6f7f9;
}

.header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20rpx;
  margin-bottom: 28rpx;
}

.title,
.subtitle,
.notice-title,
.notice-action,
.game-title,
.game-desc,
.game-action {
  display: block;
}

.title {
  font-size: 40rpx;
  font-weight: 700;
  color: #101828;
}

.subtitle {
  margin-top: 8rpx;
  color: #667085;
}

.notice {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20rpx 24rpx;
  margin-bottom: 20rpx;
  background: #fff7ed;
  border: 1px solid #fed7aa;
  border-radius: 8rpx;
}

.notice-title {
  color: #9a3412;
  font-weight: 700;
}

.notice-action {
  color: #175cd3;
}

.game-card {
  display: flex;
  align-items: center;
  padding: 28rpx;
  background: #fff;
  border: 1px solid #eaecf0;
  border-radius: 8rpx;
}

.game-mark {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 96rpx;
  height: 96rpx;
  margin-right: 20rpx;
  font-size: 36rpx;
  font-weight: 700;
  color: #0f5b5b;
  background: #dcfce7;
  border-radius: 8rpx;
}

.game-copy {
  flex: 1;
  min-width: 0;
}

.game-title {
  font-size: 32rpx;
  font-weight: 700;
  color: #101828;
}

.game-desc {
  margin-top: 8rpx;
  color: #667085;
}

.game-action {
  color: #175cd3;
}

.share-button {
  flex: 0 0 auto;
  height: 60rpx;
  margin: 0;
  padding: 0 20rpx;
  font-size: 26rpx;
  line-height: 60rpx;
  color: #175cd3;
  background: #eff8ff;
  border-radius: 8rpx;
}

.share-button::after {
  border: 0;
}

.page {
  background:
    linear-gradient(160deg, rgba(15, 118, 110, 0.28), transparent 34%),
    linear-gradient(24deg, rgba(246, 196, 83, 0.20), transparent 42%),
    repeating-linear-gradient(90deg, rgba(245, 240, 220, 0.05) 0, rgba(245, 240, 220, 0.05) 1px, transparent 1px, transparent 48rpx),
    #071112;
}

.title {
  color: #f7e8b6;
  text-shadow: 0 4rpx 18rpx rgba(246, 196, 83, 0.25);
}

.subtitle {
  color: #9ab4a8;
}

.share-button {
  color: #f7e8b6;
  background: rgba(12, 35, 31, 0.88);
  border: 1px solid rgba(246, 196, 83, 0.34);
  box-shadow: inset 0 1rpx 0 rgba(255, 255, 255, 0.16);
}

.notice {
  background: rgba(88, 54, 12, 0.84);
  border-color: rgba(246, 196, 83, 0.42);
  box-shadow: 0 12rpx 28rpx rgba(0, 0, 0, 0.25);
}

.notice-title {
  color: #ffd66b;
}

.notice-action {
  color: #9ff3d4;
}

.game-card {
  position: relative;
  overflow: hidden;
  background:
    linear-gradient(135deg, rgba(18, 52, 46, 0.96), rgba(9, 22, 22, 0.96));
  border-color: rgba(246, 196, 83, 0.42);
  box-shadow: 0 22rpx 48rpx rgba(0, 0, 0, 0.36), inset 0 1rpx 0 rgba(255, 255, 255, 0.14);
}

.game-card::after {
  position: absolute;
  right: -40rpx;
  bottom: -72rpx;
  width: 230rpx;
  height: 230rpx;
  border: 1px solid rgba(246, 196, 83, 0.18);
  transform: rotate(45deg);
  content: "";
}

.game-mark {
  color: #1d1605;
  background: linear-gradient(180deg, #ffe08a, #d99620);
  box-shadow: 0 10rpx 24rpx rgba(246, 196, 83, 0.28), inset 0 2rpx 0 rgba(255, 255, 255, 0.36);
}

.game-title {
  color: #f7e8b6;
}

.game-desc {
  color: #9ab4a8;
}

.game-action {
  color: #8df0c7;
}
</style>
