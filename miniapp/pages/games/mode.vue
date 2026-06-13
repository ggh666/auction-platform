<template>
  <view class="page">
    <view class="header">
      <text class="eyebrow">{{ gameName }}</text>
      <text class="title">选择交换方式</text>
    </view>

    <view class="mode-list">
      <view class="mode-card delegated" hover-class="mode-card-hover" @tap="openDelegated">
        <text class="mode-title">委托主理人</text>
        <text class="mode-desc">账号、道具拍卖与主理人协助</text>
        <text class="mode-action">进入</text>
      </view>
      <view class="mode-card free" hover-class="mode-card-hover" @tap="openFreeExchange">
        <text class="mode-title">自由交换</text>
        <text class="mode-desc">个人龙珠资源信息展示</text>
        <text class="mode-action">进入</text>
      </view>
      <view class="mode-card reference" hover-class="mode-card-hover" @tap="openPriceReference">
        <text class="mode-title">估值参考</text>
        <text class="mode-desc">查看龙珠职业和品质的每周参考区间</text>
        <text class="mode-action">查看</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { onLoad, onShareAppMessage, onShareTimeline, onShow } from "@dcloudio/uni-app";
import { ref } from "vue";
import { defaultGameName, normalizeGameName } from "../../utils/gameOptions";
import { buildGameModeShare, toTimelineShare } from "../../utils/share";

const gameName = ref(defaultGameName);

onLoad((query) => {
  gameName.value = normalizeGameName(query?.gameName) ?? defaultGameName;
});

onShow(() => {
  uni.showShareMenu({ withShareTicket: true, menus: ["shareAppMessage", "shareTimeline"] });
});

onShareAppMessage(() => currentShareTarget());

onShareTimeline(() => toTimelineShare(currentShareTarget()));

function currentShareTarget() {
  return buildGameModeShare({ gameName: gameName.value });
}

function openDelegated() {
  uni.navigateTo({ url: `/pages/auctions/list?gameName=${encodeURIComponent(gameName.value)}` });
}

function openFreeExchange() {
  uni.navigateTo({ url: `/pages/exchange/list?gameName=${encodeURIComponent(gameName.value)}` });
}

function openPriceReference() {
  uni.navigateTo({ url: `/pages/priceReference/index?gameName=${encodeURIComponent(gameName.value)}` });
}
</script>

<style scoped>
.page {
  min-height: 100vh;
  padding: 36rpx 24rpx;
  background:
    linear-gradient(145deg, rgba(20, 184, 166, 0.18), transparent 36%),
    linear-gradient(24deg, rgba(246, 196, 83, 0.16), transparent 44%),
    #071112;
}

.eyebrow,
.title,
.mode-title,
.mode-desc,
.mode-action {
  display: block;
}

.header {
  margin-bottom: 28rpx;
}

.eyebrow {
  margin-bottom: 8rpx;
  color: #8aa196;
  font-size: 24rpx;
}

.title {
  color: #f7e8b6;
  font-size: 40rpx;
  font-weight: 800;
}

.mode-list {
  display: flex;
  flex-direction: column;
  gap: 18rpx;
}

.mode-card {
  box-sizing: border-box;
  width: 100%;
  min-height: 192rpx;
  padding: 28rpx;
  margin: 0;
  text-align: left;
  background: rgba(11, 32, 30, 0.96);
  border: 1px solid rgba(246, 196, 83, 0.24);
  border-radius: 8rpx;
}

.mode-card.free {
  border-color: rgba(45, 212, 191, 0.34);
}

.mode-card.reference {
  border-color: rgba(96, 165, 250, 0.34);
}

.mode-card-hover {
  opacity: 0.86;
}

.mode-title {
  color: #f7e8b6;
  font-size: 32rpx;
  font-weight: 800;
}

.mode-desc {
  margin-top: 12rpx;
  color: #9ab4a8;
  line-height: 1.45;
}

.mode-action {
  margin-top: 22rpx;
  color: #f6c453;
  font-weight: 800;
}
</style>
