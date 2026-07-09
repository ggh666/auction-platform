<template>
  <view class="page">
    <view class="hero">
      <text class="kicker">活动资料</text>
      <text class="title">活动攻略</text>
      <text class="subtitle">点击图片可放大查看攻略图</text>
    </view>

    <view v-if="loading" class="state-card">
      <text>正在加载图片配置...</text>
    </view>

    <view v-else-if="dungeonGuideImageUrls.length === 0" class="state-card">
      <text class="state-title">暂未配置活动攻略图片</text>
      <text class="state-desc">请在后台系统配置中填写活动攻略图片链接。</text>
    </view>

    <view v-else class="image-stack">
      <view v-for="(imageUrl, index) in dungeonGuideImageUrls" :key="imageUrl" class="image-panel">
        <text v-if="dungeonGuideImageUrls.length > 1" class="image-index">攻略图 {{ index + 1 }}</text>
        <image
          class="guide-image"
          mode="widthFix"
          :src="imageUrl"
          @error="handleImageError(imageUrl)"
          @tap="previewImage(imageUrl)"
        />
        <text v-if="failedImageUrls.includes(imageUrl)" class="error-text">图片加载失败，请检查后台配置的图片链接。</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { onShareAppMessage, onShareTimeline, onShow } from "@dcloudio/uni-app";
import { ref } from "vue";
import { getAppConfig } from "../../api/client";
import { buildDungeonGuideShare, toTimelineShare } from "../../utils/share";

const loading = ref(true);
const failedImageUrls = ref<string[]>([]);
const dungeonGuideImageUrls = ref<string[]>([]);

onShow(() => {
  uni.showShareMenu({ withShareTicket: true, menus: ["shareAppMessage", "shareTimeline"] });
  void loadConfig();
});

onShareAppMessage(() => buildDungeonGuideShare());

onShareTimeline(() => toTimelineShare(buildDungeonGuideShare()));

async function loadConfig() {
  loading.value = true;
  failedImageUrls.value = [];
  try {
    const config = await getAppConfig();
    dungeonGuideImageUrls.value =
      config.dungeonGuideImageUrls?.map((item) => item.trim()).filter(Boolean) ?? splitImageUrls(config.dungeonGuideImageUrl);
  } catch {
    dungeonGuideImageUrls.value = [];
    uni.showToast({ title: "图片配置加载失败", icon: "none" });
  } finally {
    loading.value = false;
  }
}

function splitImageUrls(value: string): string[] {
  return value
    .split(/[\r\n,，;；]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function handleImageError(imageUrl: string) {
  if (!failedImageUrls.value.includes(imageUrl)) {
    failedImageUrls.value = [...failedImageUrls.value, imageUrl];
  }
  uni.showToast({ title: "图片加载失败", icon: "none" });
}

function previewImage(imageUrl: string) {
  if (!imageUrl || dungeonGuideImageUrls.value.length === 0) {
    return;
  }
  uni.previewImage({
    current: imageUrl,
    urls: dungeonGuideImageUrls.value
  });
}
</script>

<style scoped>
.page {
  min-height: 100vh;
  box-sizing: border-box;
  padding: 32rpx 24rpx calc(64rpx + env(safe-area-inset-bottom));
  background:
    linear-gradient(160deg, rgba(15, 118, 110, 0.24), transparent 34%),
    linear-gradient(24deg, rgba(246, 196, 83, 0.16), transparent 42%),
    repeating-linear-gradient(90deg, rgba(245, 240, 220, 0.05) 0, rgba(245, 240, 220, 0.05) 1px, transparent 1px, transparent 48rpx),
    #071112;
}

.hero,
.state-card,
.image-panel {
  border: 1px solid rgba(246, 196, 83, 0.34);
  border-radius: 8rpx;
  background: linear-gradient(135deg, rgba(18, 52, 46, 0.94), rgba(9, 22, 22, 0.94));
  box-shadow: 0 18rpx 40rpx rgba(0, 0, 0, 0.32), inset 0 1rpx 0 rgba(255, 255, 255, 0.12);
}

.hero {
  padding: 28rpx 30rpx;
  margin-bottom: 22rpx;
}

.kicker,
.title,
.subtitle,
.state-title,
.state-desc,
.error-text {
  display: block;
}

.kicker {
  color: #8df0c7;
  font-size: 24rpx;
  font-weight: 800;
}

.title {
  margin-top: 8rpx;
  color: #f7e8b6;
  font-size: 42rpx;
  font-weight: 900;
}

.subtitle,
.state-desc {
  margin-top: 8rpx;
  color: #9ab4a8;
  font-size: 26rpx;
}

.state-card {
  padding: 42rpx 30rpx;
  color: #eaf7ef;
  font-size: 28rpx;
  font-weight: 700;
}

.state-title {
  color: #f7e8b6;
  font-size: 32rpx;
  font-weight: 900;
}

.image-panel {
  overflow: hidden;
  padding: 16rpx;
}

.image-stack {
  display: flex;
  flex-direction: column;
  gap: 18rpx;
}

.image-index {
  display: block;
  margin-bottom: 12rpx;
  color: #f7e8b6;
  font-size: 26rpx;
  font-weight: 800;
}

.guide-image {
  display: block;
  width: 100%;
  border-radius: 6rpx;
  background: rgba(3, 10, 10, 0.78);
}

.error-text {
  margin-top: 16rpx;
  color: #ffb4a8;
  font-size: 26rpx;
}
</style>
