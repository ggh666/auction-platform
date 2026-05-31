<template>
  <view class="page">
    <text class="title">我的关注</text>
    <view v-if="loading && assets.length === 0" class="empty">正在加载关注列表</view>
    <view v-else-if="assets.length === 0" class="empty">暂无关注的信息</view>

    <view v-for="asset in assets" :key="asset.id" class="asset" :class="{ sold: isSoldAsset(asset) }" @tap="openDetail(asset.id)">
      <view v-if="isSoldAsset(asset)" class="sold-stamp">成交</view>
      <view class="asset-heading">
        <text class="asset-title">{{ asset.title }}</text>
        <button class="follow-button" :disabled="isFollowUpdating(asset.id)" @tap.stop="unfollow(asset)">
          已关注
        </button>
      </view>
      <text class="asset-meta">{{ asset.serverName }} / {{ displayAssetType(asset.assetType) }}</text>
      <text v-if="dragonBallLine(asset)" class="dragon-ball-line">{{ dragonBallLine(asset) }}</text>
      <text v-if="isSoldAsset(asset)" class="sold-line">状态：已成交</text>
      <text v-if="asset.principal" class="principal-line">主理人：{{ asset.principal.displayName }}，线下请联系主理人</text>
      <text class="asset-price">当前价：{{ formatPrice(asset.currentPriceCents ?? asset.startingPriceCents) }} 元宝</text>
      <text class="asset-end-time">截止时间：{{ formatTime(asset.effectiveEndAt) }}</text>
    </view>

    <view v-if="assets.length > 0" class="load-more" @tap="loadFollowedAssets()">
      <text>{{ loadingMore ? "加载中" : hasMore ? "上拉加载更多关注" : "没有更多关注了" }}</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import type { AuctionAsset } from "@auction/shared";
import { onPullDownRefresh, onReachBottom, onShow } from "@dcloudio/uni-app";
import { ref } from "vue";
import { listFollowedAssets, unfollowAsset } from "../../api/client";
import { isSoldAsset } from "../../utils/assetStatusText";
import { restrictedActionFailureMessage } from "../../utils/userActionErrors";

const assets = ref<AuctionAsset[]>([]);
const loading = ref(false);
const loadingMore = ref(false);
const hasMore = ref(false);
const nextPage = ref(1);
const total = ref(0);
const updatingIds = ref<string[]>([]);
const pageSize = 20;

onShow(() => {
  void loadFollowedAssets({ reset: true });
});

onPullDownRefresh(() => {
  void loadFollowedAssets({ reset: true }).finally(() => {
    uni.stopPullDownRefresh();
  });
});

onReachBottom(() => {
  void loadFollowedAssets();
});

async function loadFollowedAssets(options: { reset?: boolean } = {}) {
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
    const response = await listFollowedAssets({ page: requestedPage, pageSize });
    const items = response.items.map((asset) => ({ ...asset, followedByMe: true }));
    assets.value = reset ? items : [...assets.value, ...items];
    const responsePage = typeof response.page === "number" ? response.page : requestedPage;
    nextPage.value = responsePage + 1;
    total.value = typeof response.total === "number" ? response.total : assets.value.length;
    hasMore.value = typeof response.hasMore === "boolean" ? response.hasMore : response.nextCursor !== null || response.items.length >= pageSize;
  } catch {
    if (reset) {
      assets.value = [];
      nextPage.value = 1;
      total.value = 0;
      hasMore.value = false;
    }
    uni.showToast({ title: "关注列表加载失败，请先登录", icon: "none" });
  } finally {
    loading.value = false;
    loadingMore.value = false;
    uni.stopPullDownRefresh();
  }
}

function isFollowUpdating(assetId: string) {
  return updatingIds.value.includes(assetId);
}

function setFollowUpdating(assetId: string, updating: boolean) {
  updatingIds.value = updating ? [...new Set([...updatingIds.value, assetId])] : updatingIds.value.filter((id) => id !== assetId);
}

async function unfollow(asset: AuctionAsset) {
  if (isFollowUpdating(asset.id)) {
    return;
  }

  setFollowUpdating(asset.id, true);
  try {
    await unfollowAsset(asset.id);
    assets.value = assets.value.filter((item) => item.id !== asset.id);
    total.value = Math.max(0, total.value - 1);
    uni.showToast({ title: "已取消关注", icon: "none" });
  } catch (error) {
    uni.showToast({ title: restrictedActionFailureMessage(error, "unfollow", "取消关注失败"), icon: "none" });
  } finally {
    setFollowUpdating(asset.id, false);
  }
}

function formatPrice(cents: number) {
  return (cents / 100).toFixed(2);
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

function displayAssetType(assetType: string) {
  return assetType === "装备" ? "道具" : assetType;
}

function dragonBallLine(asset: AuctionAsset) {
  const dragonBall = asset.dragonBall;
  if (!dragonBall) {
    return "";
  }
  return `龙珠：${dragonBall.element}系 / ${dragonBall.profession} / ${dragonBall.quality}品质 / ${dragonBall.attributes}`;
}

function openDetail(assetId: string) {
  uni.navigateTo({ url: `/pages/auctions/detail?assetId=${assetId}` });
}
</script>

<style scoped>
.page {
  min-height: 100vh;
  padding: 24rpx;
  background: #f6f7f9;
}

.title,
.asset-title,
.asset-meta,
.dragon-ball-line,
.sold-line,
.principal-line,
.asset-price,
.asset-end-time,
.empty {
  display: block;
}

.title {
  margin-bottom: 24rpx;
  font-size: 36rpx;
  font-weight: 700;
  color: #101828;
}

.asset {
  position: relative;
  padding: 24rpx;
  margin-bottom: 16rpx;
  background: #fff;
  border: 1px solid #eaecf0;
  border-radius: 8rpx;
}

.asset-heading {
  display: flex;
  align-items: flex-start;
  gap: 16rpx;
}

.asset.sold .asset-heading {
  padding-right: 128rpx;
}

.asset-title {
  flex: 1 1 auto;
  min-width: 0;
  font-weight: 700;
  color: #101828;
}

.asset-meta {
  margin-top: 8rpx;
  color: #667085;
}

.dragon-ball-line {
  margin-top: 8rpx;
  color: #344054;
}

.sold-line {
  margin-top: 8rpx;
  font-weight: 800;
  color: #b42318;
}

.sold-stamp {
  position: absolute;
  top: 18rpx;
  right: 18rpx;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 112rpx;
  height: 112rpx;
  font-size: 32rpx;
  font-weight: 900;
  color: rgba(248, 113, 113, 0.88);
  border: 7rpx double rgba(248, 113, 113, 0.86);
  border-radius: 999rpx;
  transform: rotate(-14deg);
  pointer-events: none;
}

.principal-line {
  margin-top: 8rpx;
  color: #175cd3;
}

.asset-price {
  margin-top: 12rpx;
  color: #b42318;
}

.asset-end-time {
  margin-top: 8rpx;
  color: #475467;
}

.follow-button {
  flex: 0 0 auto;
  min-width: 112rpx;
  height: 56rpx;
  margin: 0;
  padding: 0 16rpx;
  font-size: 24rpx;
  line-height: 56rpx;
  color: #344054;
  background: #f2f4f7;
  border-radius: 8rpx;
}

.follow-button::after {
  border: 0;
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

.page {
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

.asset {
  position: relative;
  overflow: hidden;
  background: linear-gradient(145deg, rgba(16, 42, 38, 0.96), rgba(8, 19, 20, 0.98));
  border-color: rgba(246, 196, 83, 0.26);
  box-shadow: 0 14rpx 32rpx rgba(0, 0, 0, 0.26), inset 0 1rpx 0 rgba(255, 255, 255, 0.10);
}

.asset-title {
  color: #f7e8b6;
}

.asset-meta,
.dragon-ball-line,
.asset-end-time,
.empty,
.load-more {
  color: #9ab4a8;
}

.sold-line {
  color: #ffb4a7;
}

.principal-line {
  color: #8df0c7;
}

.asset-price {
  color: #ffd66b;
  font-weight: 800;
}

.follow-button {
  color: #10201d;
  font-weight: 800;
  background: linear-gradient(180deg, #a7f3d0, #34d399);
}
</style>
