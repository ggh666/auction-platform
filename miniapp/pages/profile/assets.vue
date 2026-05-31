<template>
  <view class="page">
    <text class="title">我的发布</text>
    <view v-if="loading" class="empty">正在加载发布记录</view>
    <view v-else-if="assets.length === 0" class="empty">暂无发布记录</view>
    <view v-for="asset in assets" :key="asset.id" class="asset-row" :class="{ sold: isSoldAsset(asset) }" @tap="openDetail(asset.id)">
      <view v-if="isSoldAsset(asset)" class="sold-stamp">成交</view>
      <image
        v-if="firstAssetImageUrl(asset.imageUrls)"
        class="asset-cover"
        :src="firstAssetImageUrl(asset.imageUrls) || ''"
        mode="aspectFill"
        @tap.stop="previewImages(asset.imageUrls)"
      />
      <view v-else class="asset-cover asset-cover-empty">
        <text>无图</text>
      </view>
      <view class="asset-content">
        <text class="asset-title">{{ asset.title }}</text>
        <text class="asset-meta">
          {{ assetStatusText(asset) }} / {{ asset.gameName }} / {{ asset.serverName }} / 当前价
          {{ formatPrice(asset.currentPriceCents ?? asset.startingPriceCents) }} 元宝
        </text>
        <text v-if="asset.status === 'active'" class="asset-meta">截止时间：{{ formatTime(asset.effectiveEndAt) }}</text>
      </view>
    </view>
    <text class="note">这里只展示资产信息和审核状态，不提供支付、担保或联系方式交换。</text>
  </view>
</template>

<script setup lang="ts">
import { firstAssetImageUrl, type AuctionAsset } from "@auction/shared";
import { onShow } from "@dcloudio/uni-app";
import { ref } from "vue";
import { listMyAssets } from "../../api/client";
import { assetStatusText, isSoldAsset } from "../../utils/assetStatusText";

const loading = ref(false);
const assets = ref<AuctionAsset[]>([]);

onShow(async () => {
  loading.value = true;
  try {
    const response = await listMyAssets();
    assets.value = response.items;
  } catch {
    assets.value = [];
    uni.showToast({ title: "发布记录加载失败，请先登录", icon: "none" });
  } finally {
    loading.value = false;
  }
});

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

function openDetail(assetId: string) {
  uni.navigateTo({ url: `/pages/auctions/detail?assetId=${assetId}` });
}

function previewImages(imageUrls: string[]) {
  const urls = imageUrls.map((imageUrl) => imageUrl.trim()).filter(Boolean);
  if (urls.length === 0) {
    return;
  }

  uni.previewImage({
    current: urls[0],
    urls
  });
}
</script>

<style scoped>
.page {
  padding: 24rpx;
}

.title,
.asset-title,
.asset-meta,
.note,
.empty {
  display: block;
}

.title {
  margin-bottom: 24rpx;
  font-size: 36rpx;
  font-weight: 700;
}

.asset-row {
  position: relative;
  display: flex;
  align-items: stretch;
  gap: 18rpx;
  padding: 24rpx;
  margin-bottom: 16rpx;
  border: 1px solid #eaecf0;
  border-radius: 8rpx;
  background: #fff;
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

.asset-cover {
  flex: 0 0 144rpx;
  width: 144rpx;
  height: 144rpx;
  border-radius: 8rpx;
  background: #f2f4f7;
}

.asset-cover-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  color: #98a2b3;
  font-size: 24rpx;
}

.asset-content {
  flex: 1;
  min-width: 0;
}

.asset-row.sold .asset-content {
  padding-right: 112rpx;
}

.asset-title {
  font-weight: 700;
  line-height: 1.45;
}

.asset-meta,
.note {
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

.asset-row {
  background: linear-gradient(145deg, rgba(16, 42, 38, 0.96), rgba(8, 19, 20, 0.98));
  border-color: rgba(246, 196, 83, 0.26);
  box-shadow: 0 14rpx 32rpx rgba(0, 0, 0, 0.26), inset 0 1rpx 0 rgba(255, 255, 255, 0.10);
}

.asset-cover,
.asset-cover-empty {
  background: rgba(22, 47, 43, 0.92);
  border: 1px solid rgba(246, 196, 83, 0.22);
}

.asset-cover-empty {
  color: #9ab4a8;
}

.asset-title {
  color: #f7e8b6;
}

.asset-meta,
.note,
.empty {
  color: #9ab4a8;
}
</style>
