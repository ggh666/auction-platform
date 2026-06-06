<template>
  <view class="page">
    <view class="header">
      <view class="header-copy">
        <text class="title">我的资产</text>
        <text class="summary">{{ total }} 条提交记录</text>
      </view>
      <button
        v-if="publishEnabled"
        class="publish-button"
        :disabled="contextLoading || remainingDailyPublishCount <= 0"
        @tap="openPublish"
      >
        提交资产
      </button>
    </view>

    <view v-if="!publishEnabled" class="switch-note">
      <text>{{ publishDisabledReason }}</text>
    </view>
    <view v-else-if="contextFailed" class="switch-note">
      <text>发布状态获取失败，进入发布页后会再次校验</text>
    </view>
    <view v-else-if="remainingDailyPublishCount <= 0" class="switch-note">
      <text>今日发布次数已用完，请明天再试</text>
    </view>

    <view v-if="loading && assets.length === 0" class="empty">正在加载我的资产</view>
    <view v-else-if="assets.length === 0" class="empty">暂无提交记录</view>

    <view v-for="asset in assets" :key="asset.id" class="asset-row" @tap="openDetail(asset.id)">
      <view class="asset-heading">
        <text class="asset-title">{{ asset.title }}</text>
        <text class="status-pill" :class="`status-${asset.status}`">{{ statusText(asset) }}</text>
      </view>
      <text class="asset-meta">{{ asset.gameName }} / {{ asset.serverName }} / {{ displayAssetType(asset.assetType) }}</text>
      <text v-if="asset.principal" class="principal-line">主理人：{{ asset.principal.displayName }}</text>
      <text class="asset-price">起拍价：{{ formatPrice(asset.startingPriceCents) }} 元宝</text>
      <text class="asset-time">更新时间：{{ formatTime(asset.updatedAt) }}</text>
    </view>

    <view v-if="assets.length > 0" class="load-more" @tap="loadAssets()">
      <text>{{ loadingMore ? "加载中" : hasMore ? "上拉加载更多资产" : "没有更多资产了" }}</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { centsToYuanText, type AuctionAsset } from "@auction/shared";
import { onPullDownRefresh, onReachBottom, onShow } from "@dcloudio/uni-app";
import { ref } from "vue";
import { getAssetPublishContext, listMyAssets } from "../../api/client";
import { normalizeUserAssetSubmitDisabledReason, USER_ASSET_SUBMIT_DISABLED_REASON } from "../../utils/assetPublishCopy";
import { assetStatusText } from "../../utils/assetStatusText";

const loading = ref(false);
const loadingMore = ref(false);
const assets = ref<AuctionAsset[]>([]);
const hasMore = ref(false);
const nextPage = ref(1);
const total = ref(0);
const publishEnabled = ref(true);
const publishDisabledReason = ref(USER_ASSET_SUBMIT_DISABLED_REASON);
const remainingDailyPublishCount = ref(1);
const contextLoading = ref(true);
const contextFailed = ref(false);
const pageSize = 20;

onShow(() => {
  void loadContext();
  void loadAssets({ reset: true });
});

onPullDownRefresh(() => {
  void Promise.all([loadContext(), loadAssets({ reset: true })]).finally(() => {
    uni.stopPullDownRefresh();
  });
});

onReachBottom(() => {
  void loadAssets();
});

async function loadContext() {
  contextLoading.value = true;
  contextFailed.value = false;
  try {
    const response = await getAssetPublishContext();
    publishEnabled.value = response.enabled;
    publishDisabledReason.value = normalizeUserAssetSubmitDisabledReason(response.disabledReason);
    remainingDailyPublishCount.value = response.remainingDailyPublishCount;
  } catch {
    publishEnabled.value = true;
    publishDisabledReason.value = "发布状态获取失败";
    remainingDailyPublishCount.value = 1;
    contextFailed.value = true;
  } finally {
    contextLoading.value = false;
  }
}

async function loadAssets(options: { reset?: boolean } = {}) {
  const reset = options.reset ?? false;
  if (reset) {
    nextPage.value = 1;
    hasMore.value = true;
  }
  if (loading.value || loadingMore.value || (!hasMore.value && !reset)) {
    return;
  }

  const requestedPage = reset ? 1 : nextPage.value;
  if (requestedPage === 1) {
    loading.value = true;
  } else {
    loadingMore.value = true;
  }

  try {
    const response = await listMyAssets({ page: requestedPage, pageSize });
    assets.value = reset ? response.items : [...assets.value, ...response.items];
    const responsePage = typeof response.page === "number" ? response.page : requestedPage;
    nextPage.value = responsePage + 1;
    total.value = typeof response.total === "number" ? response.total : assets.value.length;
    hasMore.value = typeof response.hasMore === "boolean" ? response.hasMore : response.items.length >= pageSize;
  } catch {
    if (reset) {
      assets.value = [];
      total.value = 0;
      hasMore.value = false;
    }
    uni.showToast({ title: "我的资产加载失败，请先登录", icon: "none" });
  } finally {
    loading.value = false;
    loadingMore.value = false;
    uni.stopPullDownRefresh();
  }
}

function openPublish() {
  if (contextLoading.value || !publishEnabled.value || remainingDailyPublishCount.value <= 0) {
    return;
  }
  uni.navigateTo({ url: "/pages/auctions/publish" });
}

function openDetail(assetId: string) {
  uni.navigateTo({ url: `/pages/auctions/detail?assetId=${assetId}` });
}

function statusText(asset: AuctionAsset) {
  return assetStatusText(asset);
}

function displayAssetType(assetType: string) {
  return assetType === "装备" ? "道具" : assetType;
}

function formatPrice(cents: number) {
  return centsToYuanText(cents);
}

function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(
    2,
    "0"
  )} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}
</script>

<style scoped>
.page {
  box-sizing: border-box;
  min-height: 100vh;
  padding: 32rpx 24rpx calc(48rpx + env(safe-area-inset-bottom));
  background:
    linear-gradient(145deg, rgba(20, 184, 166, 0.16), transparent 34%),
    linear-gradient(26deg, rgba(246, 196, 83, 0.17), transparent 44%),
    repeating-linear-gradient(90deg, rgba(245, 240, 220, 0.04) 0, rgba(245, 240, 220, 0.04) 1px, transparent 1px, transparent 46rpx),
    #071112;
}

.title,
.summary,
.switch-note,
.asset-title,
.asset-meta,
.principal-line,
.asset-price,
.asset-time,
.empty,
.load-more {
  display: block;
}

.header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18rpx;
  margin-bottom: 18rpx;
}

.header-copy {
  flex: 1;
  min-width: 0;
}

.title {
  font-size: 36rpx;
  font-weight: 800;
  color: #f7e8b6;
  text-shadow: 0 4rpx 18rpx rgba(246, 196, 83, 0.22);
}

.summary {
  margin-top: 8rpx;
  color: #9ab4a8;
}

.publish-button {
  flex: 0 0 auto;
  height: 64rpx;
  margin: 0;
  padding: 0 22rpx;
  font-size: 26rpx;
  font-weight: 800;
  line-height: 64rpx;
  color: #071112;
  background: linear-gradient(180deg, #ffe08a, #d99620);
  border-radius: 8rpx;
}

.publish-button::after {
  border: 0;
}

.publish-button[disabled] {
  color: rgba(7, 17, 18, 0.58);
  background: rgba(154, 180, 168, 0.42);
}

.switch-note {
  padding: 18rpx 20rpx;
  margin-bottom: 18rpx;
  color: #f7e8b6;
  background: rgba(246, 196, 83, 0.10);
  border: 1px solid rgba(246, 196, 83, 0.24);
  border-radius: 8rpx;
}

.asset-row {
  padding: 24rpx;
  margin-bottom: 16rpx;
  background: linear-gradient(145deg, rgba(16, 42, 38, 0.96), rgba(8, 19, 20, 0.98));
  border: 1px solid rgba(246, 196, 83, 0.26);
  border-radius: 8rpx;
  box-shadow: 0 14rpx 32rpx rgba(0, 0, 0, 0.26), inset 0 1rpx 0 rgba(255, 255, 255, 0.10);
}

.asset-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14rpx;
}

.asset-title {
  flex: 1;
  min-width: 0;
  font-size: 30rpx;
  font-weight: 800;
  line-height: 1.35;
  color: #f7e8b6;
}

.status-pill {
  flex: 0 0 auto;
  padding: 5rpx 12rpx;
  font-size: 22rpx;
  font-weight: 800;
  line-height: 1.3;
  color: #071112;
  background: #9ab4a8;
  border-radius: 999rpx;
}

.status-pending_review {
  background: #f6c453;
}

.status-active {
  background: #34d399;
}

.status-rejected,
.status-removed,
.status-cancelled {
  color: #fff;
  background: #b91c1c;
}

.asset-meta,
.principal-line,
.asset-price,
.asset-time {
  margin-top: 8rpx;
  line-height: 1.5;
  color: #9ab4a8;
}

.asset-price {
  color: #f6c453;
}

.empty,
.load-more {
  padding: 48rpx 0;
  text-align: center;
  color: #9ab4a8;
}
</style>
