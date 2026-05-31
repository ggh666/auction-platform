<template>
  <view class="page">
    <text class="title">我的出价</text>
    <view v-if="loading" class="empty">正在加载出价记录</view>
    <view v-else-if="bids.length === 0" class="empty">暂无出价记录</view>
    <view v-for="bid in bids" :key="bid.id" class="bid-row" :class="{ sold: isSoldAsset(bid.asset) }" @tap="openDetail(bid.assetId)">
      <view v-if="isSoldAsset(bid.asset)" class="sold-stamp">成交</view>
      <text class="bid-title">参与竞价：{{ bid.asset.title }}</text>
      <text class="bid-meta">
        我的出价 {{ formatPrice(bid.amountCents) }} 元宝 / 当前价
        {{ formatPrice(bid.asset.currentPriceCents ?? bid.asset.startingPriceCents) }} 元宝
      </text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { onShow } from "@dcloudio/uni-app";
import { ref } from "vue";
import { listMyBids, type ProfileBidItem } from "../../api/client";
import { isSoldAsset } from "../../utils/assetStatusText";

const loading = ref(false);
const bids = ref<ProfileBidItem[]>([]);

onShow(async () => {
  loading.value = true;
  try {
    const response = await listMyBids();
    bids.value = response.items;
  } catch {
    bids.value = [];
    uni.showToast({ title: "出价记录加载失败，请先登录", icon: "none" });
  } finally {
    loading.value = false;
  }
});

function formatPrice(cents: number) {
  return (cents / 100).toFixed(2);
}

function openDetail(assetId: string) {
  uni.navigateTo({ url: `/pages/auctions/detail?assetId=${assetId}` });
}
</script>

<style scoped>
.page {
  padding: 24rpx;
}

.title,
.bid-title,
.bid-meta,
.empty {
  display: block;
}

.title {
  margin-bottom: 24rpx;
  font-size: 36rpx;
  font-weight: 700;
}

.bid-row {
  position: relative;
  padding: 24rpx;
  margin-bottom: 16rpx;
  border: 1px solid #eaecf0;
  border-radius: 8rpx;
}

.bid-row.sold {
  padding-right: 148rpx;
}

.sold-stamp {
  position: absolute;
  top: 18rpx;
  right: 18rpx;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 104rpx;
  height: 104rpx;
  font-size: 30rpx;
  font-weight: 900;
  color: rgba(248, 113, 113, 0.88);
  border: 7rpx double rgba(248, 113, 113, 0.86);
  border-radius: 999rpx;
  transform: rotate(-14deg);
  pointer-events: none;
}

.bid-title {
  font-weight: 700;
}

.bid-meta {
  margin-top: 8rpx;
  line-height: 1.5;
  color: #667085;
}

.empty {
  padding: 48rpx 0;
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

.bid-row {
  background: linear-gradient(145deg, rgba(16, 42, 38, 0.96), rgba(8, 19, 20, 0.98));
  border-color: rgba(246, 196, 83, 0.26);
  box-shadow: 0 14rpx 32rpx rgba(0, 0, 0, 0.26), inset 0 1rpx 0 rgba(255, 255, 255, 0.10);
}

.bid-title {
  color: #f7e8b6;
}

.bid-meta,
.empty {
  color: #9ab4a8;
}
</style>
