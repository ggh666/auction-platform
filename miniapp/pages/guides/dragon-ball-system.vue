<template>
  <view class="page">
    <view class="hero-card">
      <text class="hero-kicker">塔防精灵</text>
      <text class="hero-title">龙珠体系</text>
      <text class="hero-copy">了解龙珠品质、属性范围、获取方式与深渊礼盒概率。</text>
    </view>

    <view class="panel">
      <view class="panel-title">
        <text class="title-bar"></text>
        <text class="title-text">品质属性范围</text>
      </view>
      <view class="quality-row">
        <view v-for="quality in qualities" :key="quality.name" class="quality-item">
          <view class="quality-dot" :style="{ background: quality.color }"></view>
          <text class="quality-name">{{ quality.name }}</text>
          <text class="quality-range">{{ quality.range }}</text>
        </view>
      </view>
    </view>

    <view class="intro-card">
      <view class="intro-icon">册</view>
      <text class="intro-text">查看龙珠系统介绍</text>
      <text class="intro-arrow">→</text>
    </view>

    <view class="panel">
      <view class="panel-title">
        <text class="title-bar"></text>
        <text class="title-text">龙珠获取方式</text>
      </view>

      <view class="method-list">
        <view v-for="method in methods" :key="method.title" class="method-row">
          <view class="method-index">{{ method.index }}</view>
          <view class="method-copy">
            <text class="method-title">{{ method.title }}</text>
            <text class="method-desc">{{ method.desc }}</text>
          </view>
        </view>
      </view>

      <view class="probability-list">
        <view v-for="item in probabilities" :key="item.rank" class="probability-row">
          <text class="probability-rank">{{ item.rank }}</text>
          <text class="probability-text">{{ item.text }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { onShareAppMessage, onShareTimeline, onShow } from "@dcloudio/uni-app";
import { buildDragonBallSystemShare, toTimelineShare } from "../../utils/share";

const qualities = [
  { name: "绿色", range: "1%-5%", color: "#22c55e" },
  { name: "蓝色", range: "6%-10%", color: "#3b82f6" },
  { name: "紫色", range: "11%-20%", color: "#8b5cf6" },
  { name: "金色", range: "21%-30%", color: "#facc15" },
  { name: "红色", range: "31%-50%", color: "#f97316" }
];

const methods = [
  { index: 1, title: "波澜之主成就", desc: "大漩涡通关120波（奖励：随机紫色品质龙珠*1）" },
  { index: 2, title: "赛季豪礼", desc: "累充5000元可选「随机金色品质龙珠*1」" },
  { index: 3, title: "赛季豪礼", desc: "累充1万元可选「随机红色品质龙珠*1」" },
  { index: 4, title: "深海之战", desc: "各势力个人排名前1000名奖励「随机龙珠礼盒*1」" },
  { index: 5, title: "深海泰坦挑战", desc: "职业榜前1000名奖励「随机龙珠礼盒*1」（礼盒概率与深海之战相同）" }
];

const probabilities = [
  { rank: "第1名礼盒概率", text: "红色10%、金色90%" },
  { rank: "2-3名礼盒概率", text: "红色8%、金色80%、紫色12%" },
  { rank: "4-10名礼盒概率", text: "红色6%、金色60%、紫色34%" },
  { rank: "11-20名礼盒概率", text: "红色4%、金色40%、紫色41%、蓝色15%" },
  { rank: "21-50名礼盒概率", text: "红色3%、金色20%、紫色42%、蓝色35%" },
  { rank: "51-100名礼盒概率", text: "红色2%、金色10%、紫色43%、蓝色45%" },
  { rank: "100-200名礼盒概率", text: "红色1.5%、金色7.5%、紫色36%、蓝色35%、绿色20%" },
  { rank: "201-500名礼盒概率", text: "红色1%、金色5%、紫色27%、蓝色32%、绿色35%" },
  { rank: "501-1000名礼盒概率", text: "红色0.5%、金色2.5%、紫色13%、蓝色29%、绿色55%" }
];

onShow(() => {
  uni.showShareMenu({ withShareTicket: true, menus: ["shareAppMessage", "shareTimeline"] });
});

onShareAppMessage(() => buildDragonBallSystemShare());

onShareTimeline(() => toTimelineShare(buildDragonBallSystemShare()));
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

.hero-card,
.panel,
.intro-card {
  border-radius: 8rpx;
}

.hero-card {
  padding: 28rpx;
  margin-bottom: 18rpx;
  background: linear-gradient(135deg, rgba(18, 52, 46, 0.96), rgba(9, 22, 22, 0.96));
  border: 1px solid rgba(246, 196, 83, 0.34);
  box-shadow: 0 18rpx 40rpx rgba(0, 0, 0, 0.32), inset 0 1rpx 0 rgba(255, 255, 255, 0.12);
}

.hero-kicker,
.hero-title,
.hero-copy,
.title-text,
.quality-name,
.quality-range,
.intro-text,
.intro-arrow,
.method-title,
.method-desc,
.probability-rank,
.probability-text {
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

.hero-copy {
  margin-top: 10rpx;
  color: #9ab4a8;
  font-size: 26rpx;
  line-height: 1.55;
}

.panel {
  padding: 22rpx;
  margin-bottom: 18rpx;
  background: rgba(10, 28, 26, 0.76);
  border: 1px solid rgba(246, 196, 83, 0.24);
  box-shadow: 0 14rpx 32rpx rgba(0, 0, 0, 0.24), inset 0 1rpx 0 rgba(255, 255, 255, 0.08);
}

.panel-title {
  display: flex;
  align-items: center;
  gap: 12rpx;
  margin-bottom: 22rpx;
}

.title-bar {
  width: 6rpx;
  height: 32rpx;
  background: linear-gradient(180deg, #8df0c7, #f6c453);
  border-radius: 999rpx;
}

.title-text {
  color: #f7e8b6;
  font-size: 30rpx;
  font-weight: 900;
}

.quality-row {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 10rpx;
}

.quality-item {
  min-width: 0;
  padding: 16rpx 6rpx;
  text-align: center;
  background: rgba(18, 52, 46, 0.72);
  border: 1px solid rgba(246, 196, 83, 0.16);
  border-radius: 8rpx;
}

.quality-dot {
  width: 18rpx;
  height: 18rpx;
  margin: 0 auto 10rpx;
  border-radius: 50%;
}

.quality-name {
  color: #d9eadf;
  font-size: 22rpx;
  font-weight: 800;
}

.quality-range {
  margin-top: 4rpx;
  color: #8aa196;
  font-size: 18rpx;
  line-height: 1.2;
}

.intro-card {
  display: flex;
  align-items: center;
  gap: 16rpx;
  min-height: 74rpx;
  padding: 0 22rpx;
  margin-bottom: 18rpx;
  background: linear-gradient(135deg, rgba(20, 184, 166, 0.22), rgba(126, 87, 194, 0.88));
  border: 1px solid rgba(141, 240, 199, 0.28);
  box-shadow: 0 14rpx 30rpx rgba(0, 0, 0, 0.26);
}

.intro-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 38rpx;
  height: 38rpx;
  color: #1d1605;
  font-size: 20rpx;
  font-weight: 900;
  background: #f7e8b6;
  border-radius: 50%;
}

.intro-text {
  flex: 1;
  color: #fff7d6;
  font-size: 26rpx;
  font-weight: 900;
}

.intro-arrow {
  color: #fff7d6;
  font-size: 30rpx;
  font-weight: 900;
}

.method-list {
  display: flex;
  flex-direction: column;
  gap: 18rpx;
}

.method-row {
  display: flex;
  gap: 16rpx;
}

.method-index {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  width: 42rpx;
  height: 42rpx;
  color: #fff7d6;
  font-size: 22rpx;
  font-weight: 900;
  background: linear-gradient(180deg, #8b7cf6, #5d48c7);
  border-radius: 50%;
}

.method-copy {
  flex: 1;
  min-width: 0;
}

.method-title {
  color: #8df0c7;
  font-size: 25rpx;
  font-weight: 900;
  line-height: 1.45;
}

.method-desc {
  margin-top: 4rpx;
  color: #d9eadf;
  font-size: 24rpx;
  line-height: 1.5;
}

.probability-list {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
  margin-top: 24rpx;
  padding-top: 20rpx;
  border-top: 1px solid rgba(246, 196, 83, 0.18);
}

.probability-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8rpx;
}

.probability-rank {
  color: #8df0c7;
  font-size: 24rpx;
  font-weight: 900;
  line-height: 1.55;
}

.probability-text {
  color: #d9eadf;
  font-size: 24rpx;
  line-height: 1.55;
}
</style>
