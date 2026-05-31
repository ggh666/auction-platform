<template>
  <view class="page">
    <text class="title">成交记录</text>
    <view class="followup-section">
      <view class="section-heading">
        <text class="section-title">成交跟进</text>
        <text class="section-count">{{ followups.length }} 条</text>
      </view>
      <view v-if="followupLoading && followups.length === 0" class="empty compact-empty">正在加载成交跟进</view>
      <view v-else-if="followups.length === 0" class="empty compact-empty">暂无成交跟进</view>
      <view v-for="followup in followups" :key="followup.id" class="followup-row" @tap="openDetail(followup.assetId)">
        <view class="followup-main">
          <text class="result-title">{{ followup.asset.title }}</text>
          <text class="result-asset-meta">
            {{ followup.asset.gameName }} / {{ followup.asset.serverName }} / {{ displayAssetType(followup.asset.assetType) }}
          </text>
          <text class="result-meta">
            {{ followupStatusText(followup.status) }} / 成交价 {{ formatPrice(followup.finalPriceCents) }} 元宝
          </text>
          <text v-if="followup.principal" class="result-meta">主理人：{{ followup.principal.displayName }}</text>
        </view>
      </view>
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
</template>

<script setup lang="ts">
import { centsToYuanText } from "@auction/shared";
import { onPullDownRefresh, onReachBottom, onShow } from "@dcloudio/uni-app";
import { ref } from "vue";
import {
  listMyDealFollowups,
  listMyResults,
  type DealFollowupItem,
  type ProfileResultItem
} from "../../api/client";

const loading = ref(false);
const loadingMore = ref(false);
const followupLoading = ref(false);
const hasMore = ref(false);
const nextPage = ref(1);
const total = ref(0);
const results = ref<ProfileResultItem[]>([]);
const followups = ref<DealFollowupItem[]>([]);
const pageSize = 20;

onShow(() => {
  void loadPageData({ reset: true });
});

onPullDownRefresh(() => {
  void loadPageData({ reset: true }).finally(() => {
    uni.stopPullDownRefresh();
  });
});

onReachBottom(() => {
  void loadResults();
});

async function loadPageData(options: { reset?: boolean } = {}) {
  await Promise.all([loadResults(options), loadFollowups()]);
}

async function loadFollowups() {
  followupLoading.value = true;
  try {
    const response = await listMyDealFollowups({ page: 1, pageSize: 20 });
    followups.value = response.items;
  } catch {
    followups.value = [];
  } finally {
    followupLoading.value = false;
  }
}

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

function followupStatusText(status: DealFollowupItem["status"]) {
  const map: Record<DealFollowupItem["status"], string> = {
    pending_buyer_confirm: "待主理人处理",
    buyer_confirmed: "买家曾确认",
    buyer_abandoned: "买家曾放弃",
    principal_contacted: "主理人已联系",
    buyer_unreachable: "已标记失联",
    completed: "已成交",
    cancelled: "已取消"
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
  padding: 24rpx;
}

.title,
.section-title,
.section-count,
.result-title,
.result-asset-meta,
.result-meta,
.empty,
.load-more {
  display: block;
}

.title {
  margin-bottom: 24rpx;
  font-size: 36rpx;
  font-weight: 700;
}

.result-row {
  padding: 24rpx;
  margin-bottom: 16rpx;
  border: 1px solid #eaecf0;
  border-radius: 8rpx;
}

.followup-section {
  margin-bottom: 28rpx;
}

.section-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14rpx;
}

.section-title {
  font-size: 30rpx;
  font-weight: 700;
}

.section-count {
  font-size: 24rpx;
}

.followup-row {
  padding: 24rpx;
  margin-bottom: 16rpx;
  border: 1px solid #eaecf0;
  border-radius: 8rpx;
}

.followup-main {
  min-width: 0;
}

.result-title {
  font-weight: 700;
}

.result-meta {
  margin-top: 8rpx;
  line-height: 1.5;
  color: #667085;
}

.result-asset-meta {
  margin-top: 8rpx;
  line-height: 1.5;
  color: #667085;
}

.empty {
  padding: 48rpx 0;
  text-align: center;
  color: #667085;
}

.compact-empty {
  padding: 28rpx 0;
}

.load-more {
  padding: 24rpx 0 36rpx;
  text-align: center;
  color: #667085;
}

.page {
  min-height: 100vh;
  background:
    linear-gradient(145deg, rgba(20, 184, 166, 0.16), transparent 34%),
    linear-gradient(26deg, rgba(246, 196, 83, 0.17), transparent 44%),
    repeating-linear-gradient(90deg, rgba(245, 240, 220, 0.04) 0, rgba(245, 240, 220, 0.04) 1px, transparent 1px, transparent 46rpx),
    #071112;
}

.title {
  color: #f7e8b6;
  text-shadow: 0 4rpx 18rpx rgba(246, 196, 83, 0.22);
}

.section-title {
  color: #f7e8b6;
}

.section-count {
  color: #9ab4a8;
}

.result-row,
.followup-row {
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
