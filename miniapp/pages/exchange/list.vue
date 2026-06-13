<template>
  <view class="page">
    <view class="header">
      <view>
        <text class="eyebrow">{{ gameName }}</text>
        <text class="title">自由交换</text>
      </view>
      <button class="home-button" @tap="goHome">返回主页</button>
    </view>

    <view class="toolbar" :class="{ 'toolbar-without-publish': !publishEnabled }">
      <button v-if="publishEnabled" class="publish-button" @tap="openPublish">发布交换</button>
      <input v-model="keyword" class="search-input" placeholder="搜索标题、区服、诉求" confirm-type="search" @confirm="refresh" />
    </view>

    <view class="filters">
      <picker mode="selector" :range="professionLabels" :value="selectedProfessionIndex" @change="onProfessionChange">
        <view class="filter-value">{{ professionText }}</view>
      </picker>
      <picker mode="selector" :range="qualityLabels" :value="selectedQualityIndex" @change="onQualityChange">
        <view class="filter-value">{{ qualityText }}</view>
      </picker>
    </view>

    <view v-if="loading && resources.length === 0" class="empty">正在加载交换资源</view>
    <view v-else-if="resources.length === 0" class="empty">暂无交换资源</view>

    <view v-for="resource in resources" :key="resource.id" class="resource-card" @tap="openDetail(resource.id)">
      <image v-if="resource.imageUrl" class="resource-image" :src="resource.imageUrl" mode="aspectFill" />
      <view v-else class="resource-image resource-image-placeholder">
        <text>暂无图片</text>
      </view>
      <view class="resource-body">
        <view class="card-heading">
          <text class="resource-title">{{ resource.title }}</text>
          <text class="resource-status">{{ resource.dragonBall.quality }}品质</text>
        </view>
        <text class="resource-meta">{{ resource.serverName || "未填区服" }} / {{ resource.dragonBall.element }}系 / {{ resource.dragonBall.profession }}</text>
        <text class="resource-line">属性：{{ resource.dragonBall.attributes }}</text>
        <text class="resource-line">参考金额：{{ referenceAmountText(resource.dragonBallAmountCents) }}</text>
        <text class="resource-line">想换：{{ resource.desiredExchange }}</text>
        <text class="resource-publisher">{{ resource.publisher?.displayName ?? "发布者" }}</text>
      </view>
    </view>

    <view v-if="loading && resources.length > 0" class="loading-more">加载中</view>
    <view v-if="!hasMore && resources.length > 0" class="loading-more">已全部加载</view>
  </view>
</template>

<script setup lang="ts">
import { centsToYuanText, dragonBallProfessionOptions, dragonBallQualityOptions, type ExchangeResource } from "@auction/shared";
import { onLoad, onPullDownRefresh, onReachBottom, onShareAppMessage, onShareTimeline, onShow } from "@dcloudio/uni-app";
import { computed, ref } from "vue";
import { getExchangeResourceContext, listExchangeResources } from "../../api/client";
import { defaultGameName, normalizeGameName } from "../../utils/gameOptions";
import { buildExchangeResourceListShare, toTimelineShare } from "../../utils/share";

const pageSize = 10;
const gameName = ref(defaultGameName);
const resources = ref<ExchangeResource[]>([]);
const page = ref(1);
const hasMore = ref(true);
const loading = ref(false);
const keyword = ref("");
const selectedProfession = ref("");
const selectedQuality = ref("");
const publishEnabled = ref(false);

const professionLabels = ["全部职业", ...dragonBallProfessionOptions];
const qualityLabels = ["全部品质", ...dragonBallQualityOptions.map((quality) => `${quality}品质`)];
const selectedProfessionIndex = computed(() =>
  Math.max(0, dragonBallProfessionOptions.findIndex((profession) => profession === selectedProfession.value) + 1)
);
const selectedQualityIndex = computed(() =>
  Math.max(0, dragonBallQualityOptions.findIndex((quality) => quality === selectedQuality.value) + 1)
);
const professionText = computed(() => selectedProfession.value || "全部职业");
const qualityText = computed(() => (selectedQuality.value ? `${selectedQuality.value}品质` : "全部品质"));

onLoad((query) => {
  gameName.value = normalizeGameName(query?.gameName) ?? defaultGameName;
  if (typeof query?.dragonBallProfession === "string") {
    selectedProfession.value = decodeURIComponent(query.dragonBallProfession).trim();
  }
  if (typeof query?.dragonBallQuality === "string") {
    selectedQuality.value = decodeURIComponent(query.dragonBallQuality).trim();
  }
  if (typeof query?.keyword === "string") {
    keyword.value = decodeURIComponent(query.keyword).trim();
  }
  void loadPublishContext();
  void refresh();
});

onShow(() => {
  uni.showShareMenu({ withShareTicket: true, menus: ["shareAppMessage", "shareTimeline"] });
});

onPullDownRefresh(() => {
  refresh().finally(() => uni.stopPullDownRefresh());
});

onReachBottom(() => {
  if (hasMore.value && !loading.value) {
    void loadResources(page.value + 1);
  }
});

onShareAppMessage(() => currentShareTarget());

onShareTimeline(() => toTimelineShare(currentShareTarget()));

function currentShareTarget() {
  return buildExchangeResourceListShare({
    gameName: gameName.value,
    dragonBallProfession: selectedProfession.value,
    dragonBallQuality: selectedQuality.value,
    keyword: keyword.value
  });
}

async function refresh() {
  void loadPublishContext();
  page.value = 1;
  hasMore.value = true;
  await loadResources(1);
}

async function loadPublishContext() {
  try {
    const response = await getExchangeResourceContext(gameName.value);
    publishEnabled.value = response.enabled;
  } catch {
    publishEnabled.value = false;
  }
}

async function loadResources(nextPage: number) {
  loading.value = true;
  try {
    const response = await listExchangeResources({
      page: nextPage,
      pageSize,
      gameName: gameName.value,
      dragonBallProfession: selectedProfession.value || undefined,
      dragonBallQuality: selectedQuality.value || undefined,
      keyword: keyword.value.trim() || undefined
    });
    resources.value = nextPage === 1 ? response.items : [...resources.value, ...response.items];
    page.value = response.page;
    hasMore.value = response.hasMore;
  } catch {
    uni.showToast({ title: "交换资源加载失败", icon: "none" });
  } finally {
    loading.value = false;
  }
}

function readPickerIndex(event: { detail?: { value?: unknown } }): number {
  const value = event.detail?.value;
  const index = typeof value === "number" ? value : Number(value);
  return Number.isInteger(index) && index >= 0 ? index : 0;
}

function onProfessionChange(event: { detail?: { value?: unknown } }) {
  const index = readPickerIndex(event);
  selectedProfession.value = index === 0 ? "" : dragonBallProfessionOptions[index - 1] ?? "";
  void refresh();
}

function onQualityChange(event: { detail?: { value?: unknown } }) {
  const index = readPickerIndex(event);
  selectedQuality.value = index === 0 ? "" : dragonBallQualityOptions[index - 1] ?? "";
  void refresh();
}

function openDetail(resourceId: string) {
  uni.navigateTo({ url: `/pages/exchange/detail?resourceId=${encodeURIComponent(resourceId)}` });
}

function openPublish() {
  uni.navigateTo({ url: `/pages/exchange/publish?gameName=${encodeURIComponent(gameName.value)}` });
}

function goHome() {
  uni.switchTab({ url: "/pages/games/index" });
}

function referenceAmountText(value: number | null) {
  return value === null ? "未填写参考金额" : `${centsToYuanText(value)} 元宝`;
}
</script>

<style scoped>
.page {
  min-height: 100vh;
  padding: 28rpx 24rpx calc(48rpx + env(safe-area-inset-bottom));
  background:
    linear-gradient(145deg, rgba(20, 184, 166, 0.16), transparent 34%),
    linear-gradient(26deg, rgba(246, 196, 83, 0.14), transparent 44%),
    #071112;
}

.eyebrow,
.title,
.resource-title,
.resource-status,
.resource-meta,
.resource-line,
.resource-publisher {
  display: block;
}

.header {
  display: flex;
  justify-content: space-between;
  gap: 18rpx;
  margin-bottom: 22rpx;
}

.eyebrow {
  margin-bottom: 6rpx;
  color: #8aa196;
  font-size: 24rpx;
}

.title {
  color: #f7e8b6;
  font-size: 38rpx;
  font-weight: 800;
}

.home-button,
.publish-button {
  height: 64rpx;
  margin: 0;
  padding: 0 22rpx;
  color: #071112;
  font-size: 24rpx;
  font-weight: 800;
  line-height: 64rpx;
  background: #f6c453;
  border-radius: 6rpx;
}

.home-button::after,
.publish-button::after {
  border: 0;
}

.toolbar {
  display: grid;
  grid-template-columns: 164rpx minmax(0, 1fr);
  gap: 12rpx;
  margin-bottom: 16rpx;
}

.toolbar-without-publish {
  grid-template-columns: minmax(0, 1fr);
}

.search-input,
.filter-value {
  box-sizing: border-box;
  height: 64rpx;
  padding: 0 18rpx;
  color: #f7e8b6;
  background: rgba(11, 32, 30, 0.96);
  border: 1px solid rgba(246, 196, 83, 0.22);
  border-radius: 6rpx;
}

.filters {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12rpx;
  margin-bottom: 18rpx;
}

.filter-value {
  line-height: 64rpx;
}

.resource-card {
  display: grid;
  grid-template-columns: 164rpx minmax(0, 1fr);
  gap: 18rpx;
  padding: 22rpx;
  margin-bottom: 16rpx;
  background: rgba(11, 32, 30, 0.96);
  border: 1px solid rgba(45, 212, 191, 0.24);
  border-radius: 8rpx;
}

.resource-image {
  width: 164rpx;
  height: 164rpx;
  background: rgba(7, 17, 18, 0.7);
  border-radius: 8rpx;
}

.resource-image-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  color: #8aa196;
  font-size: 24rpx;
  text-align: center;
  border: 1px dashed rgba(246, 196, 83, 0.26);
}

.resource-body {
  min-width: 0;
}

.card-heading {
  display: flex;
  justify-content: space-between;
  gap: 16rpx;
}

.resource-title {
  min-width: 0;
  color: #f7e8b6;
  font-size: 30rpx;
  font-weight: 800;
}

.resource-status {
  flex-shrink: 0;
  color: #f6c453;
  font-weight: 800;
}

.resource-meta,
.resource-line,
.resource-publisher,
.empty,
.loading-more {
  color: #9ab4a8;
}

.resource-meta,
.resource-line {
  margin-top: 10rpx;
  line-height: 1.45;
}

.resource-publisher {
  margin-top: 14rpx;
  font-size: 24rpx;
}

.empty,
.loading-more {
  padding: 68rpx 0;
  text-align: center;
}
</style>
