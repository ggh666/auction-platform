<template>
  <view class="page">
    <view v-if="loading" class="empty">正在加载交换详情</view>
    <view v-else-if="!detail" class="empty">未找到交换宝贝</view>
    <view v-else>
      <view class="detail-heading">
        <text class="title">{{ detail.asset.title }}</text>
        <button class="share-detail-button" open-type="share">分享宝贝</button>
      </view>
      <view v-if="imageUrls.length > 0" class="image-grid">
        <image
          v-for="(imageUrl, index) in imageUrls"
          :key="`${imageUrl}-${index}`"
          class="asset-image"
          mode="aspectFill"
          :src="imageUrl"
          @tap="previewImage(index)"
        />
      </view>
      <view class="panel">
        <text class="label">宝贝信息</text>
        <text class="content">{{ detail.asset.gameName }} / {{ detail.asset.serverName }} / {{ displayAssetType(detail.asset.assetType) }}</text>
        <view v-if="detail.asset.dragonBall" class="dragon-ball-box">
          <text class="dragon-ball-title">龙珠：{{ detail.asset.dragonBall.element }}系 / {{ detail.asset.dragonBall.profession }}</text>
          <text class="dragon-ball-content">品质：{{ detail.asset.dragonBall.quality }}</text>
          <text class="dragon-ball-content">属性：{{ detail.asset.dragonBall.attributes }}</text>
        </view>
        <text class="content">{{ detail.asset.description }}</text>
        <text class="content">卖家：{{ detail.seller.displayName }}</text>
        <view v-if="detail.asset.principal" class="principal-box">
          <text class="principal-title">主理人：{{ detail.asset.principal.displayName }}</text>
          <text class="principal-tip">需要沟通交换信息时，请优先联系该主理人。</text>
        </view>
        <view v-if="detail.asset.hasPublishedViolation" class="violation-tags">
          <text v-if="detail.asset.hasPublishedViolation" class="violation-tag">该宝贝关联违规公示</text>
        </view>
        <text class="content">状态：{{ assetStatusText(detail.asset.status) }}</text>
      </view>
      <view class="panel">
        <text class="label">竞价区</text>
        <text class="content">当前价：{{ formatPrice(detail.asset.currentPriceCents ?? detail.asset.startingPriceCents) }} 元宝</text>
        <text class="content">最低加价：{{ formatPrice(detail.asset.minIncrementCents) }} 元宝</text>
        <text v-if="!unavailableMessage" class="content">本次最低出价：{{ formatPrice(requiredBidCentsForDetail()) }} 元宝</text>
        <text v-if="unavailableMessage" class="notice">{{ unavailableMessage }}</text>
        <input
          v-model="bidAmountYuan"
          class="input"
          :disabled="Boolean(unavailableMessage)"
          type="digit"
          placeholder="输入出价金额，单位元宝"
        />
      </view>
      <view class="panel">
        <text class="label">最近出价</text>
        <text v-if="detail.recentBids.length === 0" class="content">暂无出价记录</text>
        <text v-for="bid in detail.recentBids" :key="bid.id" class="content">
          {{ bid.bidder.displayName }}：{{ formatPrice(bid.amountCents) }} 元宝 / {{ formatTime(bid.createdAt) }}
        </text>
      </view>
      <button class="primary-action" :loading="submitting" :disabled="submitting || Boolean(unavailableMessage)" @tap="submitBid">
        {{ unavailableMessage ? "不可估价" : "提交估价" }}
      </button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { centsToYuanText, type AssetDetailResponse, type AuctionWsEvent, type BidDisplayRecord } from "@auction/shared";
import { onLoad, onShareAppMessage, onShareTimeline, onUnload } from "@dcloudio/uni-app";
import { computed, ref } from "vue";
import { getAssetDetail, placeBid, readApiBase } from "../../api/client";
import { readSessionUser } from "../../auth/session";
import { mergeAuctionAssetUpdate } from "../../utils/assetMerge";
import { assetStatusText } from "../../utils/assetStatusText";
import { auctionUnavailableMessage, bidFailureMessage, requiredBidCents, validateBidAmountYuan } from "../../utils/bidAmount";
import { confirmTradingDisclaimer } from "../../utils/disclaimer";
import { connectAuctionSocket, type AuctionSocketTask } from "../../utils/realtime";
import { buildAssetDetailShare, toTimelineShare } from "../../utils/share";
import { requestPriceChangeSubscription } from "../../utils/subscribeMessage";

const submitting = ref(false);
const loading = ref(false);
const assetId = ref("");
const detail = ref<AssetDetailResponse | null>(null);
const bidAmountYuan = ref("");
const now = ref(new Date());
let nowTimer: ReturnType<typeof setInterval> | null = null;
let auctionSocket: AuctionSocketTask | null = null;

const imageUrls = computed(() => detail.value?.asset.imageUrls.map((imageUrl) => imageUrl.trim()).filter(Boolean) ?? []);
const unavailableMessage = computed(() =>
  detail.value ? auctionUnavailableMessage(detail.value.asset, now.value) : "交换详情未加载完成"
);

onLoad((query) => {
  const value = query?.assetId;
  assetId.value = typeof value === "string" ? value : "";
  uni.showShareMenu({ withShareTicket: true, menus: ["shareAppMessage", "shareTimeline"] });
  nowTimer = setInterval(() => {
    now.value = new Date();
  }, 1000);
  connectAuctionRealtime();
  void loadDetail();
});

onUnload(() => {
  if (nowTimer !== null) {
    clearInterval(nowTimer);
    nowTimer = null;
  }
  closeAuctionRealtime();
});

onShareAppMessage(() => currentShareTarget());

onShareTimeline(() => toTimelineShare(currentShareTarget()));

function currentShareTarget() {
  return buildAssetDetailShare({
    assetId: assetId.value,
    title: detail.value?.asset.title,
    gameName: detail.value?.asset.gameName,
    imageUrls: imageUrls.value
  });
}

async function loadDetail() {
  if (!assetId.value) {
    return;
  }

  loading.value = true;
  try {
    detail.value = await getAssetDetail(assetId.value);
    bidAmountYuan.value = formatPrice(requiredBidCentsForDetail());
  } catch {
    detail.value = null;
    uni.showToast({ title: "交换详情加载失败", icon: "none" });
  } finally {
    loading.value = false;
  }
}

function requiredBidCentsForDetail() {
  const asset = detail.value?.asset;
  if (!asset) {
    return 0;
  }

  return requiredBidCents(asset);
}

function previewImage(index: number) {
  if (imageUrls.value.length === 0) {
    return;
  }

  uni.previewImage({
    urls: imageUrls.value,
    current: imageUrls.value[index] ?? imageUrls.value[0]
  });
}

function closeAuctionRealtime() {
  if (auctionSocket) {
    auctionSocket.close?.({});
    auctionSocket = null;
  }
}

function connectAuctionRealtime() {
  closeAuctionRealtime();
  if (!assetId.value) {
    return;
  }

  auctionSocket = connectAuctionSocket({
    apiBase: readApiBase(),
    assetId: assetId.value,
    connectSocket(input) {
      return uni.connectSocket(input) as unknown as AuctionSocketTask;
    },
    onEvent(event) {
      applyAuctionEvent(event);
    }
  });
}

function prependRecentBid(bid: BidDisplayRecord) {
  if (!detail.value) {
    return;
  }
  detail.value = {
    ...detail.value,
    recentBids: [bid, ...detail.value.recentBids.filter((item) => item.id !== bid.id)].slice(0, 20)
  };
}

function applyAuctionEvent(event: AuctionWsEvent) {
  if (!detail.value) {
    return;
  }
  if (event.type === "bid_accepted") {
    detail.value = {
      ...detail.value,
      asset: mergeAuctionAssetUpdate(detail.value.asset, event.asset)
    };
    prependRecentBid(event.bid);
    bidAmountYuan.value = formatPrice(requiredBidCentsForDetail());
    const currentUser = readSessionUser();
    if (!currentUser || currentUser.id !== event.bid.bidderId) {
      uni.showToast({ title: `${event.bid.bidder.displayName} 出价 ${formatPrice(event.bid.amountCents)} 元`, icon: "none" });
    }
    return;
  }
  if (event.type === "auction_extended") {
    detail.value = {
      ...detail.value,
      asset: mergeAuctionAssetUpdate(detail.value.asset, event.asset)
    };
    bidAmountYuan.value = formatPrice(requiredBidCentsForDetail());
  }
}

async function submitBid() {
  if (submitting.value) {
    return;
  }

  if (!assetId.value) {
    uni.showToast({ title: "缺少宝贝编号，无法出价", icon: "none" });
    return;
  }

  submitting.value = true;
  try {
    const asset = detail.value?.asset;
    if (!asset) {
      uni.showToast({ title: "交换详情未加载完成", icon: "none" });
      return;
    }
    const unavailable = auctionUnavailableMessage(asset);
    if (unavailable) {
      uni.showToast({ title: unavailable, icon: "none" });
      return;
    }

    const validation = validateBidAmountYuan(bidAmountYuan.value, asset);
    if (!validation.ok) {
      uni.showToast({ title: validation.message, icon: "none" });
      return;
    }

    const acceptedDisclaimer = await confirmTradingDisclaimer();
    if (!acceptedDisclaimer) {
      return;
    }

    const response = await placeBid({ assetId: assetId.value, amountCents: validation.amountCents });
    if (detail.value) {
      detail.value = {
        ...detail.value,
        asset: mergeAuctionAssetUpdate(detail.value.asset, response.asset)
      };
      prependRecentBid(response.bid);
      bidAmountYuan.value = formatPrice(requiredBidCentsForDetail());
    }
    await requestPriceChangeSubscription();
    uni.showToast({ title: "出价已提交", icon: "none" });
  } catch (error) {
    uni.showToast({ title: bidFailureMessage(error, requiredBidCentsForDetail()), icon: "none" });
  } finally {
    submitting.value = false;
  }
}

function formatPrice(cents: number) {
  return centsToYuanText(cents);
}

function displayAssetType(assetType: string) {
  return assetType === "装备" ? "道具" : assetType;
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
  padding: 24rpx;
}

.title,
.label,
.content {
  display: block;
}

.title {
  font-size: 36rpx;
  font-weight: 700;
  color: #101828;
}

.detail-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20rpx;
  margin-bottom: 24rpx;
}

.share-detail-button {
  flex: 0 0 auto;
  height: 60rpx;
  margin: 0;
  padding: 0 20rpx;
  font-size: 26rpx;
  line-height: 60rpx;
  color: #175cd3;
  background: #eff8ff;
  border-radius: 8rpx;
}

.share-detail-button::after {
  border: 0;
}

.panel {
  padding: 24rpx;
  margin-bottom: 16rpx;
  border: 1px solid #eaecf0;
  border-radius: 8rpx;
}

.image-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12rpx;
  margin-bottom: 16rpx;
}

.asset-image {
  width: 100%;
  height: calc((100vw - 72rpx) / 3);
  border-radius: 8rpx;
  background: #eaecf0;
}

.label {
  margin-bottom: 8rpx;
  font-weight: 700;
}

.content {
  line-height: 1.6;
  color: #667085;
}

.principal-box {
  margin-top: 14rpx;
  padding: 18rpx;
  background: #eff8ff;
  border: 1px solid #b2ddff;
  border-radius: 8rpx;
}

.dragon-ball-box {
  margin-top: 14rpx;
  margin-bottom: 12rpx;
  padding: 18rpx;
  background: #f8fafc;
  border: 1px solid #d0d5dd;
  border-radius: 8rpx;
}

.dragon-ball-title,
.dragon-ball-content {
  display: block;
}

.dragon-ball-title {
  font-weight: 700;
  color: #101828;
}

.dragon-ball-content {
  margin-top: 6rpx;
  color: #475467;
}

.principal-title,
.principal-tip {
  display: block;
}

.principal-title {
  font-weight: 700;
  color: #175cd3;
}

.principal-tip {
  margin-top: 6rpx;
  color: #475467;
}

.violation-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8rpx;
  margin-top: 12rpx;
}

.violation-tag {
  display: inline-block;
  padding: 4rpx 12rpx;
  font-size: 24rpx;
  color: #b42318;
  background: #fef3f2;
  border: 1px solid #fecdca;
  border-radius: 8rpx;
}

.notice {
  display: block;
  margin-top: 16rpx;
  padding: 16rpx;
  color: #b42318;
  background: #fef3f2;
  border-radius: 8rpx;
}

.input {
  box-sizing: border-box;
  width: 100%;
  height: 80rpx;
  margin-top: 16rpx;
  padding: 0 20rpx;
  border: 1px solid #d0d5dd;
  border-radius: 8rpx;
}

.empty {
  padding: 48rpx 0;
  text-align: center;
  color: #667085;
}

.page {
  min-height: 100vh;
  background:
    linear-gradient(150deg, rgba(45, 212, 191, 0.17), transparent 34%),
    linear-gradient(20deg, rgba(246, 196, 83, 0.18), transparent 42%),
    repeating-linear-gradient(90deg, rgba(245, 240, 220, 0.04) 0, rgba(245, 240, 220, 0.04) 1px, transparent 1px, transparent 46rpx),
    #071112;
}

.title {
  color: #f7e8b6;
  line-height: 1.35;
  text-shadow: 0 4rpx 18rpx rgba(246, 196, 83, 0.22);
}

.share-detail-button {
  color: #f7e8b6;
  background: rgba(11, 32, 30, 0.9);
  border: 1px solid rgba(246, 196, 83, 0.32);
}

.panel {
  position: relative;
  overflow: hidden;
  background: linear-gradient(145deg, rgba(16, 42, 38, 0.96), rgba(8, 19, 20, 0.98));
  border-color: rgba(246, 196, 83, 0.28);
  box-shadow: 0 16rpx 38rpx rgba(0, 0, 0, 0.30), inset 0 1rpx 0 rgba(255, 255, 255, 0.10);
}

.panel::before {
  position: absolute;
  top: 0;
  right: 0;
  left: 0;
  height: 4rpx;
  background: linear-gradient(90deg, #f6c453, #2dd4bf, transparent);
  content: "";
}

.asset-image {
  background: rgba(22, 47, 43, 0.9);
  border: 1px solid rgba(246, 196, 83, 0.22);
  box-shadow: 0 10rpx 22rpx rgba(0, 0, 0, 0.24);
}

.label {
  color: #ffd66b;
}

.content,
.principal-tip,
.dragon-ball-content,
.empty {
  color: #9ab4a8;
}

.principal-box,
.dragon-ball-box {
  background: rgba(11, 32, 30, 0.92);
  border-color: rgba(134, 239, 172, 0.28);
}

.principal-title,
.dragon-ball-title {
  color: #8df0c7;
}

.violation-tag,
.notice {
  color: #ffd0c7;
  background: rgba(127, 29, 29, 0.72);
  border: 1px solid rgba(248, 113, 113, 0.38);
}

.input {
  color: #f5f0dc;
  background: rgba(8, 24, 23, 0.94);
  border-color: rgba(134, 239, 172, 0.24);
}

.primary-action {
  margin-top: 8rpx;
}
</style>
