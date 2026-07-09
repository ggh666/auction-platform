<template>
  <view class="page">
    <view class="header">
      <view>
        <text class="eyebrow">资源推荐</text>
        <text class="title">主播推荐</text>
      </view>
      <view class="header-actions">
        <button class="share-button" open-type="share">分享</button>
        <button class="home-button" @tap="goHome">返回主页</button>
      </view>
    </view>

    <view v-if="loading && anchors.length === 0" class="empty">正在加载主播推荐</view>
    <view v-else-if="anchors.length === 0" class="empty">暂无主播推荐</view>

    <view v-for="anchor in anchors" :key="anchor.id" class="anchor-card">
      <image class="anchor-image" :src="anchor.imageUrl" mode="aspectFill" @tap="previewAnchorImage(anchor.imageUrl)" />
      <view class="anchor-body">
        <text class="anchor-name">{{ anchor.name }}</text>
        <text class="anchor-intro">{{ anchor.intro }}</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import type { AnchorRecommendation } from "@auction/shared";
import { onLoad, onPullDownRefresh, onShareAppMessage, onShareTimeline, onShow } from "@dcloudio/uni-app";
import { ref } from "vue";
import { listAnchorRecommendations } from "../../api/client";
import { buildAnchorRecommendationsShare, toTimelineShare } from "../../utils/share";

const anchors = ref<AnchorRecommendation[]>([]);
const loading = ref(false);

onLoad(() => {
  void refresh();
});

onShow(() => {
  uni.showShareMenu({ withShareTicket: true, menus: ["shareAppMessage", "shareTimeline"] });
});

onPullDownRefresh(() => {
  refresh().finally(() => uni.stopPullDownRefresh());
});

onShareAppMessage(() => buildAnchorRecommendationsShare());

onShareTimeline(() => toTimelineShare(buildAnchorRecommendationsShare()));

async function refresh() {
  loading.value = true;
  try {
    const response = await listAnchorRecommendations();
    anchors.value = response.items;
  } catch {
    uni.showToast({ title: "主播推荐加载失败", icon: "none" });
  } finally {
    loading.value = false;
  }
}

function goHome() {
  uni.switchTab({ url: "/pages/games/index" });
}

function previewAnchorImage(imageUrl: string) {
  const previewUrl = imageUrl.trim();
  if (!previewUrl) {
    uni.showToast({ title: "暂无可查看图片", icon: "none" });
    return;
  }
  uni.previewImage({ current: previewUrl, urls: [previewUrl] });
}
</script>

<style scoped>
.page {
  min-height: 100vh;
  padding: 28rpx 24rpx calc(48rpx + env(safe-area-inset-bottom));
  background:
    linear-gradient(150deg, rgba(20, 184, 166, 0.18), transparent 32%),
    linear-gradient(24deg, rgba(246, 196, 83, 0.16), transparent 44%),
    repeating-linear-gradient(90deg, rgba(245, 240, 220, 0.05) 0, rgba(245, 240, 220, 0.05) 1px, transparent 1px, transparent 48rpx),
    #071112;
}

.header {
  display: flex;
  justify-content: space-between;
  gap: 18rpx;
  margin-bottom: 24rpx;
}

.header-actions {
  display: flex;
  flex: 0 0 auto;
  gap: 12rpx;
  align-items: flex-start;
}

.eyebrow,
.title,
.anchor-name,
.anchor-intro {
  display: block;
}

.eyebrow {
  margin-bottom: 6rpx;
  color: #8aa196;
  font-size: 24rpx;
}

.title {
  color: #f7e8b6;
  font-size: 40rpx;
  font-weight: 800;
}

.home-button,
.share-button {
  flex: 0 0 auto;
  height: 60rpx;
  margin: 0;
  padding: 0 20rpx;
  color: #f7e8b6;
  font-size: 26rpx;
  line-height: 60rpx;
  background: rgba(12, 35, 31, 0.88);
  border: 1px solid rgba(246, 196, 83, 0.34);
  border-radius: 8rpx;
}

.home-button::after,
.share-button::after {
  border: 0;
}

.empty {
  padding: 72rpx 24rpx;
  color: #9ab4a8;
  font-size: 28rpx;
  text-align: center;
  border: 1px dashed rgba(246, 196, 83, 0.32);
  border-radius: 8rpx;
}

.anchor-card {
  display: grid;
  grid-template-columns: 168rpx minmax(0, 1fr);
  gap: 20rpx;
  align-items: center;
  padding: 18rpx;
  margin-bottom: 18rpx;
  background: linear-gradient(135deg, rgba(18, 52, 46, 0.96), rgba(9, 22, 22, 0.96));
  border: 1px solid rgba(246, 196, 83, 0.36);
  border-radius: 8rpx;
  box-shadow: 0 18rpx 42rpx rgba(0, 0, 0, 0.28), inset 0 1rpx 0 rgba(255, 255, 255, 0.12);
}

.anchor-image {
  width: 168rpx;
  height: 168rpx;
  background: rgba(12, 35, 31, 0.9);
  border-radius: 8rpx;
}

.anchor-body {
  min-width: 0;
}

.anchor-name {
  color: #f7e8b6;
  font-size: 32rpx;
  font-weight: 800;
}

.anchor-intro {
  margin-top: 12rpx;
  color: #9ab4a8;
  font-size: 26rpx;
  line-height: 1.55;
}
</style>
