<template>
  <view class="page">
    <view class="hero">
      <view>
        <text class="hero-kicker">攻略地图</text>
        <text class="hero-title">深海之战</text>
      </view>
      <button class="share-button" open-type="share">分享</button>
    </view>

    <view class="map-panel">
      <view class="map-title">深海之战地图</view>
      <view class="map-grid">
        <view v-for="(row, rowIndex) in deepSeaMapRows" :key="rowIndex" class="map-row">
          <view
            v-for="(cell, colIndex) in row"
            :key="`${rowIndex}-${colIndex}-${cell.name}`"
            class="map-cell"
            :class="[cell.type]"
            @tap="handleCellTap(cell)"
          >
            <view class="cell-mark">{{ cell.icon }}</view>
            <text class="cell-name">{{ cell.name }}</text>
          </view>
        </view>
      </view>
    </view>

    <view class="legend-panel">
      <text class="legend-title">图示</text>
      <view class="legend-row">
        <view class="legend-item">
          <view class="legend-mark main-city">城</view>
          <text>玩家主城</text>
        </view>
        <view class="legend-item">
          <view class="legend-mark boss">魔</view>
          <text>路径</text>
        </view>
        <view class="legend-item">
          <view class="legend-mark royal-city">王</view>
          <text>王城</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import type { DeepSeaMapCell } from "@auction/shared";
import { deepSeaMapRows } from "@auction/shared";
import { onShareAppMessage, onShareTimeline, onShow } from "@dcloudio/uni-app";
import { buildDeepSeaBattleShare, toTimelineShare } from "../../utils/share";

onShow(() => {
  uni.showShareMenu({ withShareTicket: true, menus: ["shareAppMessage", "shareTimeline"] });
});

onShareAppMessage(() => buildDeepSeaBattleShare());

onShareTimeline(() => toTimelineShare(buildDeepSeaBattleShare()));

function handleCellTap(cell: DeepSeaMapCell) {
  if ((cell.type === "boss" || cell.type === "royal-city") && cell.section !== null) {
    openDeepSeaBoss(cell.section);
    return;
  }
  uni.showToast({ title: cell.toastName || cell.name, icon: "none" });
}

function openDeepSeaBoss(section: number) {
  uni.navigateTo({ url: `/pages/guides/deep-sea-boss?section=${section}` });
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
  margin-bottom: 20rpx;
}

.hero-kicker,
.hero-title,
.map-title,
.cell-name,
.legend-title {
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

.map-panel,
.legend-panel {
  padding: 22rpx;
  background: rgba(10, 28, 26, 0.76);
  border: 1px solid rgba(246, 196, 83, 0.24);
  border-radius: 8rpx;
  box-shadow: 0 14rpx 32rpx rgba(0, 0, 0, 0.24), inset 0 1rpx 0 rgba(255, 255, 255, 0.08);
}

.map-panel {
  margin-bottom: 18rpx;
}

.map-title,
.legend-title {
  margin-bottom: 18rpx;
  color: #f7e8b6;
  font-size: 30rpx;
  font-weight: 900;
  text-align: center;
}

.map-grid {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}

.map-row {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 12rpx;
}

.map-cell {
  display: flex;
  aspect-ratio: 1;
  min-width: 0;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8rpx;
  padding: 8rpx 4rpx;
  background: linear-gradient(135deg, rgba(18, 52, 46, 0.96), rgba(9, 22, 22, 0.96));
  border: 1px solid rgba(246, 196, 83, 0.26);
  border-radius: 8rpx;
  box-shadow: inset 0 1rpx 0 rgba(255, 255, 255, 0.1);
}

.map-cell:active {
  transform: scale(0.96);
}

.map-cell.main-city {
  border-color: rgba(141, 240, 199, 0.42);
}

.map-cell.boss {
  border-color: rgba(246, 196, 83, 0.4);
}

.map-cell.royal-city {
  background: linear-gradient(135deg, rgba(246, 196, 83, 0.26), rgba(18, 52, 46, 0.96));
  border-color: rgba(246, 196, 83, 0.74);
  box-shadow: 0 0 28rpx rgba(246, 196, 83, 0.24), inset 0 1rpx 0 rgba(255, 255, 255, 0.16);
}

.cell-mark,
.legend-mark {
  display: flex;
  align-items: center;
  justify-content: center;
  color: #1d1605;
  font-weight: 900;
  background: linear-gradient(180deg, #ffe08a, #d99620);
  border-radius: 50%;
}

.cell-mark {
  width: 48rpx;
  height: 48rpx;
  font-size: 22rpx;
}

.cell-name {
  color: #d9eadf;
  font-size: 21rpx;
  font-weight: 800;
  line-height: 1.2;
  text-align: center;
}

.legend-row {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14rpx;
}

.legend-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10rpx;
  color: #d9eadf;
  font-size: 24rpx;
  font-weight: 800;
}

.legend-mark {
  width: 64rpx;
  height: 64rpx;
  font-size: 24rpx;
}

.legend-mark.main-city {
  background: linear-gradient(180deg, #8df0c7, #1a7f6a);
}

.legend-mark.boss {
  background: linear-gradient(180deg, #ffe08a, #d99620);
}

.legend-mark.royal-city {
  background: linear-gradient(180deg, #fff4b8, #f0b429);
}
</style>
