<template>
  <view class="page">
    <view class="copy-banner">
      <view class="copy-icon">码</view>
      <view>
        <text class="copy-text">点击复制兑换码</text>
        <text class="copy-subtext">整行可点，复制后前往游戏内兑换</text>
      </view>
    </view>

    <view v-if="loading" class="empty-state">正在加载兑换码</view>
    <view v-else-if="items.length === 0" class="empty-state">暂无兑换码</view>
    <view v-else class="code-list">
      <view v-for="item in items" :key="item.code" class="code-row" @tap="copyCode(item.code)">
        <view class="code-main">
          <text class="code">{{ item.code }}</text>
          <text class="description">{{ item.description }}</text>
        </view>
        <view class="code-meta">
          <text class="validity">效期：{{ item.validity }}</text>
          <text class="tap-hint">复制</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import type { RedeemCodeItem } from "@auction/shared";
import { onLoad, onPullDownRefresh, onShareAppMessage, onShareTimeline, onShow } from "@dcloudio/uni-app";
import { ref } from "vue";
import { listRedeemCodes } from "../../api/client";
import { buildRedeemCodesShare, toTimelineShare } from "../../utils/share";

const items = ref<RedeemCodeItem[]>([]);
const loading = ref(false);

onLoad(() => {
  void loadCodes();
});

onShow(() => {
  uni.showShareMenu({ withShareTicket: true, menus: ["shareAppMessage", "shareTimeline"] });
});

onPullDownRefresh(() => {
  loadCodes().finally(() => uni.stopPullDownRefresh());
});

onShareAppMessage(() => buildRedeemCodesShare());

onShareTimeline(() => toTimelineShare(buildRedeemCodesShare()));

async function loadCodes() {
  loading.value = true;
  try {
    const response = await listRedeemCodes();
    items.value = response.items;
  } catch {
    items.value = [];
    uni.showToast({ title: "兑换码加载失败", icon: "none" });
  } finally {
    loading.value = false;
  }
}

function copyCode(code: string) {
  uni.setClipboardData({
    data: code,
    success() {
      uni.showToast({ title: "内容已复制", icon: "none" });
    }
  });
}
</script>

<style scoped>
.page {
  min-height: 100vh;
  box-sizing: border-box;
  padding: 24rpx 24rpx calc(40rpx + env(safe-area-inset-bottom));
  background:
    linear-gradient(160deg, rgba(15, 118, 110, 0.24), transparent 34%),
    linear-gradient(24deg, rgba(246, 196, 83, 0.18), transparent 42%),
    repeating-linear-gradient(90deg, rgba(245, 240, 220, 0.05) 0, rgba(245, 240, 220, 0.05) 1px, transparent 1px, transparent 48rpx),
    #071112;
}

.copy-banner {
  display: flex;
  align-items: center;
  gap: 18rpx;
  min-height: 104rpx;
  margin-bottom: 20rpx;
  padding: 20rpx 24rpx;
  background: linear-gradient(135deg, rgba(246, 196, 83, 0.2), rgba(18, 52, 46, 0.78));
  border: 1px solid rgba(246, 196, 83, 0.34);
  border-radius: 8rpx;
  box-shadow: 0 14rpx 34rpx rgba(0, 0, 0, 0.28), inset 0 1rpx 0 rgba(255, 255, 255, 0.14);
}

.copy-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 64rpx;
  height: 64rpx;
  color: #1d1605;
  font-size: 26rpx;
  font-weight: 900;
  background: linear-gradient(180deg, #ffe08a, #d99620);
  border-radius: 50%;
  box-shadow: 0 10rpx 24rpx rgba(246, 196, 83, 0.26), inset 0 2rpx 0 rgba(255, 255, 255, 0.36);
}

.copy-text {
  display: block;
  color: #f7e8b6;
  font-size: 30rpx;
  font-weight: 800;
  line-height: 1.35;
}

.copy-subtext {
  display: block;
  margin-top: 6rpx;
  color: #9ab4a8;
  font-size: 24rpx;
  line-height: 1.45;
}

.empty-state {
  margin-top: 28rpx;
  padding: 72rpx 32rpx;
  color: #9ab4a8;
  font-size: 28rpx;
  font-weight: 700;
  text-align: center;
  background: rgba(10, 28, 26, 0.72);
  border: 1px solid rgba(246, 196, 83, 0.24);
  border-radius: 8rpx;
}

.code-list {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.code-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20rpx;
  min-height: 126rpx;
  padding: 24rpx;
  background: linear-gradient(135deg, rgba(18, 52, 46, 0.96), rgba(9, 22, 22, 0.96));
  border: 1px solid rgba(246, 196, 83, 0.26);
  border-radius: 8rpx;
  box-shadow: 0 14rpx 32rpx rgba(0, 0, 0, 0.3), inset 0 1rpx 0 rgba(255, 255, 255, 0.1);
}

.code-main {
  flex: 1;
  min-width: 0;
}

.code,
.description,
.validity,
.tap-hint {
  display: block;
}

.code {
  color: #f7e8b6;
  font-size: 32rpx;
  font-weight: 800;
  line-height: 1.35;
  word-break: break-all;
  text-shadow: 0 4rpx 16rpx rgba(246, 196, 83, 0.18);
}

.description {
  margin-top: 10rpx;
  color: #9ab4a8;
  font-size: 26rpx;
  font-weight: 700;
  line-height: 1.45;
}

.code-meta {
  display: flex;
  flex: 0 0 auto;
  max-width: 300rpx;
  flex-direction: column;
  align-items: flex-end;
  gap: 10rpx;
}

.validity {
  color: #f7e8b6;
  font-size: 24rpx;
  font-weight: 800;
  line-height: 1.35;
  text-align: right;
  word-break: break-word;
}

.tap-hint {
  padding: 8rpx 16rpx;
  color: #8df0c7;
  font-size: 22rpx;
  font-weight: 800;
  line-height: 1;
  background: rgba(20, 184, 166, 0.12);
  border: 1px solid rgba(141, 240, 199, 0.34);
  border-radius: 999rpx;
}
</style>
