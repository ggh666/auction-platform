<template>
  <view class="page">
    <view class="hero">
      <text class="kicker">活动资料</text>
      <text class="title">活动材料</text>
      <text class="subtitle">点击图片可放大查看材料表</text>
    </view>

    <view v-if="loading" class="state-card">
      <text>正在加载图片配置...</text>
    </view>

    <view v-else-if="!dungeonMaterialImageUrl" class="state-card">
      <text class="state-title">暂未配置活动材料图片</text>
      <text class="state-desc">请在后台系统配置中填写活动材料图片链接。</text>
    </view>

    <view v-else class="image-panel">
      <image
        class="guide-image"
        mode="widthFix"
        :src="dungeonMaterialImageUrl"
        @error="handleImageError"
        @tap="previewImage"
      />
      <text v-if="imageError" class="error-text">图片加载失败，请检查后台配置的图片链接。</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { onShareAppMessage, onShareTimeline, onShow } from "@dcloudio/uni-app";
import { ref } from "vue";
import { getAppConfig } from "../../api/client";
import { buildDungeonMaterialsShare, toTimelineShare } from "../../utils/share";

const loading = ref(true);
const imageError = ref(false);
const dungeonMaterialImageUrl = ref("");

onShow(() => {
  uni.showShareMenu({ withShareTicket: true, menus: ["shareAppMessage", "shareTimeline"] });
  void loadConfig();
});

onShareAppMessage(() => buildDungeonMaterialsShare());

onShareTimeline(() => toTimelineShare(buildDungeonMaterialsShare()));

async function loadConfig() {
  loading.value = true;
  imageError.value = false;
  try {
    const config = await getAppConfig();
    dungeonMaterialImageUrl.value = config.dungeonMaterialImageUrl.trim();
  } catch {
    dungeonMaterialImageUrl.value = "";
    uni.showToast({ title: "图片配置加载失败", icon: "none" });
  } finally {
    loading.value = false;
  }
}

function handleImageError() {
  imageError.value = true;
  uni.showToast({ title: "图片加载失败", icon: "none" });
}

function previewImage() {
  if (!dungeonMaterialImageUrl.value) {
    return;
  }
  uni.previewImage({
    current: dungeonMaterialImageUrl.value,
    urls: [dungeonMaterialImageUrl.value]
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
