<template>
  <view class="page">
    <view class="header">
      <view>
        <text class="title">攻略</text>
        <text class="subtitle">常用工具与福利信息</text>
      </view>
      <button class="share-button" open-type="share">分享</button>
    </view>

    <view class="section-heading">
      <text class="section-kicker">副本</text>
      <text class="section-title">副本计算</text>
    </view>

    <view class="tool-grid">
      <view class="tool-card tool-card-wide" @tap="openDeepSeaBattle">
        <view class="tool-mark">海</view>
        <text class="tool-title">深海之战</text>
        <text class="tool-desc">地图点位与伤害属性计算</text>
      </view>
    </view>

    <view class="section-heading section-heading-secondary">
      <text class="section-kicker">其它</text>
      <text class="section-title">实用入口</text>
    </view>

    <view class="tool-grid">
      <view class="tool-card" @tap="openDragonBallSystem">
        <view class="tool-mark">龙</view>
        <text class="tool-title">龙珠体系</text>
        <text class="tool-desc">品质、属性与获取方式</text>
      </view>
      <view class="tool-card" @tap="openRedeemCodes">
        <view class="tool-mark">码</view>
        <text class="tool-title">兑换码</text>
        <text class="tool-desc">礼包码与福利码</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { onShareAppMessage, onShareTimeline, onShow } from "@dcloudio/uni-app";
import { buildGuidesShare, toTimelineShare } from "../../utils/share";
import { syncCustomTabBarSelected } from "../../utils/tabBar";

onShow(() => {
  syncCustomTabBarSelected(1);
  uni.showShareMenu({ withShareTicket: true, menus: ["shareAppMessage", "shareTimeline"] });
});

onShareAppMessage(() => buildGuidesShare());

onShareTimeline(() => toTimelineShare(buildGuidesShare()));

function openDeepSeaBattle() {
  uni.navigateTo({ url: "/pages/guides/deep-sea-battle" });
}

function openRedeemCodes() {
  uni.navigateTo({ url: "/pages/guides/redeem-codes" });
}

function openDragonBallSystem() {
  uni.navigateTo({ url: "/pages/guides/dragon-ball-system" });
}
</script>

<style scoped>
.page {
  min-height: 100vh;
  box-sizing: border-box;
  padding: 32rpx 24rpx calc(180rpx + env(safe-area-inset-bottom));
  background:
    linear-gradient(160deg, rgba(15, 118, 110, 0.24), transparent 34%),
    linear-gradient(24deg, rgba(246, 196, 83, 0.18), transparent 42%),
    repeating-linear-gradient(90deg, rgba(245, 240, 220, 0.05) 0, rgba(245, 240, 220, 0.05) 1px, transparent 1px, transparent 48rpx),
    #071112;
}

.title,
.subtitle,
.section-kicker,
.section-title,
.tool-title,
.tool-desc {
  display: block;
}

.header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20rpx;
  margin-bottom: 32rpx;
}

.title {
  color: #f7e8b6;
  font-size: 42rpx;
  font-weight: 800;
  text-shadow: 0 4rpx 18rpx rgba(246, 196, 83, 0.25);
}

.subtitle {
  margin-top: 8rpx;
  color: #9ab4a8;
  font-size: 28rpx;
}

.share-button {
  flex: 0 0 auto;
  height: 60rpx;
  margin: 0;
  padding: 0 20rpx;
  color: #f7e8b6;
  font-size: 26rpx;
  font-weight: 700;
  line-height: 60rpx;
  background: rgba(12, 35, 31, 0.88);
  border: 1px solid rgba(246, 196, 83, 0.34);
  border-radius: 8rpx;
  box-shadow: inset 0 1rpx 0 rgba(255, 255, 255, 0.16);
}

.share-button::after {
  border: 0;
}

.section-heading {
  margin-bottom: 18rpx;
}

.section-heading-secondary {
  margin-top: 32rpx;
}

.section-kicker {
  color: #8df0c7;
  font-size: 24rpx;
  font-weight: 800;
}

.section-title {
  margin-top: 6rpx;
  color: #f7e8b6;
  font-size: 34rpx;
  font-weight: 800;
}

.tool-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18rpx;
}

.tool-card {
  display: flex;
  min-height: 186rpx;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 22rpx 18rpx;
  background: linear-gradient(135deg, rgba(18, 52, 46, 0.96), rgba(9, 22, 22, 0.96));
  border: 1px solid rgba(246, 196, 83, 0.34);
  border-radius: 8rpx;
  box-shadow: 0 18rpx 40rpx rgba(0, 0, 0, 0.32), inset 0 1rpx 0 rgba(255, 255, 255, 0.12);
}

.tool-card-wide {
  grid-column: 1 / -1;
  min-height: 156rpx;
}

.tool-mark {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 72rpx;
  height: 72rpx;
  margin-bottom: 18rpx;
  color: #1d1605;
  font-size: 30rpx;
  font-weight: 900;
  background: linear-gradient(180deg, #ffe08a, #d99620);
  border-radius: 50%;
  box-shadow: 0 10rpx 24rpx rgba(246, 196, 83, 0.26), inset 0 2rpx 0 rgba(255, 255, 255, 0.36);
}

.tool-title {
  color: #f7e8b6;
  font-size: 30rpx;
  font-weight: 800;
}

.tool-desc {
  margin-top: 8rpx;
  color: #9ab4a8;
  font-size: 24rpx;
}
</style>
