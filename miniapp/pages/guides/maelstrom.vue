<template>
  <view class="page">
    <view class="hero">
      <view>
        <text class="hero-kicker">副本计算</text>
        <text class="hero-title">大漩涡</text>
        <text class="hero-subtitle">最高关卡：龙族·红龙 / 龙族·黑龙</text>
      </view>
      <button class="share-button" open-type="share">分享</button>
    </view>

    <view class="section-grid">
      <view
        v-for="section in maelstromSections"
        :key="section"
        class="section-card"
        :class="{ disabled: !bossFor(section).hasCalculator }"
        @tap="openMaelstromBoss(section)"
      >
        <text class="section-number">{{ section }}</text>
        <text class="section-name">{{ bossFor(section).name }}</text>
        <text class="section-tag">{{ bossFor(section).hasCalculator ? "伤害演算" : "机制说明" }}</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { getMaelstromBoss, maelstromSections } from "@auction/shared";
import { onShareAppMessage, onShareTimeline, onShow } from "@dcloudio/uni-app";
import { buildMaelstromShare, toTimelineShare } from "../../utils/share";

onShow(() => {
  uni.showShareMenu({ withShareTicket: true, menus: ["shareAppMessage", "shareTimeline"] });
});

onShareAppMessage(() => buildMaelstromShare());

onShareTimeline(() => toTimelineShare(buildMaelstromShare()));

function bossFor(section: number) {
  return getMaelstromBoss(section);
}

function openMaelstromBoss(section: number) {
  uni.navigateTo({ url: `/pages/guides/maelstrom-boss?section=${section}` });
}
</script>

<style scoped>
.page {
  min-height: 100vh;
  box-sizing: border-box;
  padding: 24rpx 24rpx calc(44rpx + env(safe-area-inset-bottom));
  background:
    linear-gradient(160deg, rgba(15, 118, 110, 0.24), transparent 34%),
    linear-gradient(24deg, rgba(246, 196, 83, 0.18), transparent 42%),
    repeating-linear-gradient(90deg, rgba(245, 240, 220, 0.05) 0, rgba(245, 240, 220, 0.05) 1px, transparent 1px, transparent 48rpx),
    #071112;
}

.hero {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20rpx;
  margin-bottom: 22rpx;
}

.hero-kicker,
.hero-title,
.hero-subtitle,
.section-number,
.section-name,
.section-tag {
  display: block;
}

.hero-kicker {
  color: #8df0c7;
  font-size: 24rpx;
  font-weight: 800;
}

.hero-title {
  margin-top: 6rpx;
  color: #f7e8b6;
  font-size: 42rpx;
  font-weight: 900;
  text-shadow: 0 4rpx 18rpx rgba(246, 196, 83, 0.25);
}

.hero-subtitle {
  margin-top: 8rpx;
  color: #9ab4a8;
  font-size: 24rpx;
  font-weight: 700;
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
}

.share-button::after {
  border: 0;
}

.section-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16rpx;
}

.section-card {
  display: flex;
  min-height: 156rpx;
  flex-direction: column;
  justify-content: center;
  padding: 18rpx 12rpx;
  text-align: center;
  background: linear-gradient(135deg, rgba(18, 52, 46, 0.96), rgba(9, 22, 22, 0.96));
  border: 1px solid rgba(246, 196, 83, 0.34);
  border-radius: 8rpx;
  box-shadow: 0 14rpx 32rpx rgba(0, 0, 0, 0.26), inset 0 1rpx 0 rgba(255, 255, 255, 0.1);
}

.section-card:active {
  transform: scale(0.97);
}

.section-card.disabled {
  border-color: rgba(141, 240, 199, 0.26);
}

.section-number {
  color: #f15c8f;
  font-size: 42rpx;
  font-weight: 900;
}

.section-name {
  margin-top: 10rpx;
  color: #d9eadf;
  font-size: 23rpx;
  font-weight: 900;
}

.section-tag {
  margin-top: 8rpx;
  color: #8df0c7;
  font-size: 20rpx;
  font-weight: 800;
}
</style>
