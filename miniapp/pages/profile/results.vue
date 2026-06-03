<template>
  <view class="page">
    <view class="results-section">
      <view class="section-heading results-heading">
        <text class="section-title">历史成交</text>
        <text class="section-count">{{ total }} 条</text>
      </view>
      <view v-if="loading && results.length === 0" class="empty">正在加载成交记录</view>
      <view v-else-if="results.length === 0" class="empty">暂无成交记录</view>
      <view v-for="result in results" :key="result.assetId" class="result-row" @tap="openDetail(result.assetId)">
        <text class="result-title">{{ statusText(result.status) }}：{{ result.asset.title }}</text>
        <text class="result-asset-meta">{{ result.asset.gameName }} / {{ result.asset.serverName }} / {{ displayAssetType(result.asset.assetType) }}</text>
        <text class="result-meta">
          {{ result.finalPriceCents === null ? "未成交" : `成交价 ${formatPrice(result.finalPriceCents)} 元宝` }} /
          记录时间 {{ formatDate(result.settledAt) }}
        </text>
      </view>
      <view v-if="results.length > 0" class="load-more" @tap="loadResults()">
        <text>{{ loadingMore ? "加载中" : hasMore ? "上拉加载更多成交记录" : "没有更多成交记录了" }}</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { centsToYuanText } from "@auction/shared";
import { onPullDownRefresh, onReachBottom, onShow } from "@dcloudio/uni-app";
import { ref } from "vue";
import { listMyResults, type ProfileResultItem } from "../../api/client";

const loading = ref(false);
const loadingMore = ref(false);
const hasMore = ref(false);
const nextPage = ref(1);
const total = ref(0);
const results = ref<ProfileResultItem[]>([]);
const pageSize = 20;

onShow(() => {
  void loadResults({ reset: true });
});

onPullDownRefresh(() => {
  void loadResults({ reset: true }).finally(() => {
    uni.stopPullDownRefresh();
  });
});

onReachBottom(() => {
  void loadResults();
});

async function loadResults(options: { reset?: boolean } = {}) {
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
    const response = await listMyResults({ page: requestedPage, pageSize });
    results.value = reset ? response.items : [...results.value, ...response.items];
    const responsePage = typeof response.page === "number" ? response.page : requestedPage;
    nextPage.value = responsePage + 1;
    total.value = typeof response.total === "number" ? response.total : results.value.length;
    hasMore.value = typeof response.hasMore === "boolean" ? response.hasMore : response.items.length >= pageSize;
  } catch {
    if (reset) {
      results.value = [];
      nextPage.value = 1;
      total.value = 0;
      hasMore.value = false;
    }
    uni.showToast({ title: "成交记录加载失败，请先登录", icon: "none" });
  } finally {
    loading.value = false;
    loadingMore.value = false;
    uni.stopPullDownRefresh();
  }
}

function statusText(status: ProfileResultItem["status"]) {
  const map: Record<ProfileResultItem["status"], string> = {
    sold: "已成交",
    unsold: "已流拍",
    cancelled: "已取消",
    removed: "已下架"
  };
  return map[status];
}

function displayAssetType(assetType: string) {
  return assetType === "装备" ? "道具" : assetType;
}

function formatPrice(cents: number) {
  return centsToYuanText(cents);
}

function openDetail(assetId: string) {
  uni.navigateTo({ url: `/pages/auctions/detail?assetId=${assetId}` });
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(
    2,
    "0"
  )}`;
}
</script>

<style scoped>
.page {
  box-sizing: border-box;
  min-height: 100vh;
  padding: 32rpx 24rpx calc(40rpx + env(safe-area-inset-bottom));
  background:
    linear-gradient(145deg, rgba(20, 184, 166, 0.16), transparent 34%),
    linear-gradient(26deg, rgba(246, 196, 83, 0.17), transparent 44%),
    repeating-linear-gradient(90deg, rgba(245, 240, 220, 0.04) 0, rgba(245, 240, 220, 0.04) 1px, transparent 1px, transparent 46rpx),
    #071112;
}

.section-title,
.section-count,
.result-title,
.result-asset-meta,
.result-meta,
.empty,
.load-more {
  display: block;
}

.result-row {
  padding: 24rpx;
  margin-bottom: 16rpx;
  border: 1px solid #eaecf0;
  border-radius: 8rpx;
}

.results-section {
  margin-top: 0;
}

.section-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 4rpx;
  margin-bottom: 14rpx;
}

.results-heading {
  margin-top: 4rpx;
}

.section-title {
  font-size: 30rpx;
  line-height: 1.35;
  font-weight: 700;
}

.section-count {
  padding: 4rpx 12rpx;
  font-size: 24rpx;
  line-height: 1.3;
  border-radius: 999rpx;
}

.result-title {
  font-size: 30rpx;
  line-height: 1.35;
  font-weight: 700;
}

.result-meta {
  margin-top: 8rpx;
  font-size: 28rpx;
  line-height: 1.5;
  color: #667085;
}

.result-asset-meta {
  margin-top: 8rpx;
  font-size: 28rpx;
  line-height: 1.5;
  color: #667085;
}

.empty {
  padding: 48rpx 0;
  text-align: center;
  color: #667085;
}

.load-more {
  padding: 24rpx 0 36rpx;
  text-align: center;
  color: #667085;
}

.section-title {
  color: #f7e8b6;
}

.section-count {
  color: #9ab4a8;
  background: rgba(154, 180, 168, 0.10);
}

.result-row {
  background: linear-gradient(145deg, rgba(16, 42, 38, 0.96), rgba(8, 19, 20, 0.98));
  border-color: rgba(246, 196, 83, 0.26);
  box-shadow: 0 14rpx 32rpx rgba(0, 0, 0, 0.26), inset 0 1rpx 0 rgba(255, 255, 255, 0.10);
}

.result-title {
  color: #f7e8b6;
}

.result-asset-meta,
.result-meta,
.empty,
.load-more {
  color: #9ab4a8;
}

</style>
