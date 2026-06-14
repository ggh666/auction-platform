<template>
  <view class="page">
    <view class="header">
      <view class="header-copy">
        <text class="title">我的交换</text>
        <text class="summary">{{ total }} 条发布记录</text>
      </view>
      <button v-if="publishEnabled" class="publish-button" @tap="openPublish">发布交换</button>
    </view>

    <view v-if="backendUnavailable" class="switch-note">
      <text>我的交换暂不可用，请稍后再试</text>
    </view>

    <view v-if="loading && resources.length === 0" class="empty">正在加载我的交换</view>
    <view v-else-if="resources.length === 0" class="empty">暂无交换发布</view>

    <view v-for="resource in resources" :key="resource.id" class="resource-row" @tap="openDetail(resource)">
      <image v-if="resource.imageUrl" class="resource-image" :src="resource.imageUrl" mode="aspectFill" />
      <view v-else class="resource-image resource-image-placeholder">
        <text>暂无图片</text>
      </view>
      <view class="resource-body">
        <view class="resource-heading">
          <text class="resource-title">{{ resource.title }}</text>
          <text class="status-pill" :class="`status-${resource.status}`">{{ statusText(resource.status) }}</text>
        </view>
        <text class="resource-meta">{{ resource.gameName }} / {{ resource.serverName || "未填区服" }} / 龙珠</text>
        <text class="resource-line">{{ resource.dragonBall.element }}系 / {{ resource.dragonBall.profession }} / {{ resource.dragonBall.quality }}品质</text>
        <text class="resource-line">属性：{{ resource.dragonBall.attributes }}</text>
        <text class="resource-line">参考金额：{{ referenceAmountText(resource.dragonBallAmountCents) }}</text>
        <text class="resource-line">想换：{{ resource.desiredExchange }}</text>
        <text class="resource-time">过期时间：{{ formatTime(resource.expiresAt) }}</text>
        <text class="resource-time">更新时间：{{ formatTime(resource.updatedAt) }}</text>
        <view class="resource-actions">
          <button v-if="resource.status === 'active'" class="secondary-button" @tap.stop="openDetail(resource)">查看详情</button>
          <button
            v-if="resource.status === 'active'"
            class="danger-button"
            :disabled="isClosing(resource.id)"
            @tap.stop="confirmClose(resource)"
          >
            关闭交换
          </button>
        </view>
      </view>
    </view>

    <view v-if="resources.length > 0" class="load-more" @tap="loadResources()">
      <text>{{ loadingMore ? "加载中" : hasMore ? "上拉加载更多交换" : "没有更多交换了" }}</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { centsToYuanText, type ExchangeResource, type ExchangeResourceStatus } from "@auction/shared";
import { onPullDownRefresh, onReachBottom, onShow } from "@dcloudio/uni-app";
import { ref } from "vue";
import { closeExchangeResource, getExchangeResourceContext, listMyExchangeResources } from "../../api/client";

const pageSize = 20;
const loading = ref(false);
const loadingMore = ref(false);
const resources = ref<ExchangeResource[]>([]);
const hasMore = ref(false);
const nextPage = ref(1);
const total = ref(0);
const closingIds = ref<string[]>([]);
const backendUnavailable = ref(false);
const publishEnabled = ref(false);

onShow(() => {
  void loadPublishContext();
  void loadResources({ reset: true });
});

onPullDownRefresh(() => {
  void loadResources({ reset: true }).finally(() => {
    uni.stopPullDownRefresh();
  });
});

onReachBottom(() => {
  void loadResources();
});

async function loadPublishContext() {
  try {
    const response = await getExchangeResourceContext();
    publishEnabled.value = response.enabled;
  } catch (error) {
    publishEnabled.value = false;
  }
}

async function loadResources(options: { reset?: boolean } = {}) {
  const reset = options.reset ?? false;
  if (reset) {
    nextPage.value = 1;
    hasMore.value = true;
    backendUnavailable.value = false;
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
    const response = await listMyExchangeResources({ page: requestedPage, pageSize });
    resources.value = reset ? response.items : [...resources.value, ...response.items];
    const responsePage = typeof response.page === "number" ? response.page : requestedPage;
    nextPage.value = responsePage + 1;
    total.value = typeof response.total === "number" ? response.total : resources.value.length;
    hasMore.value = typeof response.hasMore === "boolean" ? response.hasMore : response.items.length >= pageSize;
    backendUnavailable.value = false;
  } catch (error) {
    if (reset) {
      resources.value = [];
      total.value = 0;
      hasMore.value = false;
    }
    if (readStatusCode(error) === 404 || readStatusCode(error) === 410) {
      backendUnavailable.value = true;
      return;
    }
    uni.showToast({ title: "我的交换加载失败，请先登录", icon: "none" });
  } finally {
    loading.value = false;
    loadingMore.value = false;
    uni.stopPullDownRefresh();
  }
}

function readStatusCode(error: unknown) {
  if (typeof error === "object" && error !== null && "statusCode" in error) {
    const statusCode = (error as { statusCode?: unknown }).statusCode;
    return typeof statusCode === "number" ? statusCode : 0;
  }
  return 0;
}

function statusText(status: ExchangeResourceStatus) {
  if (status === "active") {
    return "展示中";
  }
  if (status === "pending_image_review") {
    return "图片审核中";
  }
  if (status === "expired") {
    return "已过期";
  }
  if (status === "closed") {
    return "已关闭";
  }
  return "已下架";
}

function isClosing(resourceId: string) {
  return closingIds.value.includes(resourceId);
}

function setClosing(resourceId: string, closing: boolean) {
  closingIds.value = closing
    ? [...new Set([...closingIds.value, resourceId])]
    : closingIds.value.filter((id) => id !== resourceId);
}

function confirmClose(resource: ExchangeResource) {
  if (isClosing(resource.id) || resource.status !== "active") {
    return;
  }
  uni.showModal({
    title: "关闭交换",
    content: "关闭后将不再展示在自由交换列表，已有会话仍可继续查看。",
    confirmText: "关闭",
    confirmColor: "#b42318",
    success(result) {
      if (result.confirm) {
        void closeResource(resource);
      }
    }
  });
}

async function closeResource(resource: ExchangeResource) {
  setClosing(resource.id, true);
  try {
    const response = await closeExchangeResource(resource.id);
    resources.value = resources.value.map((item) => (item.id === resource.id ? response.resource : item));
    uni.showToast({ title: "已关闭", icon: "none" });
  } catch {
    uni.showToast({ title: "关闭失败", icon: "none" });
  } finally {
    setClosing(resource.id, false);
  }
}

function openDetail(resource: ExchangeResource) {
  if (resource.status === "pending_image_review") {
    uni.showToast({ title: "图片审核通过后可查看详情", icon: "none" });
    return;
  }
  if (resource.status === "expired") {
    uni.showToast({ title: "交换已过期，请重新发布", icon: "none" });
    return;
  }
  if (resource.status !== "active") {
    uni.showToast({ title: "已关闭的交换不在列表展示", icon: "none" });
    return;
  }
  uni.navigateTo({ url: `/pages/exchange/detail?resourceId=${encodeURIComponent(resource.id)}` });
}

function openPublish() {
  uni.navigateTo({ url: "/pages/exchange/publish" });
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

function referenceAmountText(value: number | null) {
  return value === null ? "未填写参考金额" : `${centsToYuanText(value)} 元宝`;
}
</script>

<style scoped>
.page {
  box-sizing: border-box;
  min-height: 100vh;
  padding: 32rpx 24rpx calc(48rpx + env(safe-area-inset-bottom));
  background:
    linear-gradient(145deg, rgba(20, 184, 166, 0.16), transparent 34%),
    linear-gradient(26deg, rgba(246, 196, 83, 0.14), transparent 44%),
    repeating-linear-gradient(90deg, rgba(245, 240, 220, 0.04) 0, rgba(245, 240, 220, 0.04) 1px, transparent 1px, transparent 46rpx),
    #071112;
}

.title,
.summary,
.switch-note,
.resource-title,
.resource-meta,
.resource-line,
.resource-time,
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
  color: #f7e8b6;
  font-size: 36rpx;
  font-weight: 800;
  text-shadow: 0 4rpx 18rpx rgba(246, 196, 83, 0.22);
}

.summary {
  margin-top: 8rpx;
  color: #9ab4a8;
}

.publish-button,
.secondary-button,
.danger-button {
  flex: 0 0 auto;
  height: 64rpx;
  margin: 0;
  padding: 0 22rpx;
  font-size: 26rpx;
  font-weight: 800;
  line-height: 64rpx;
  border-radius: 8rpx;
}

.publish-button {
  color: #071112;
  background: linear-gradient(180deg, #ffe08a, #d99620);
}

.secondary-button {
  color: #f7e8b6;
  background: rgba(22, 47, 43, 0.9);
  border: 1px solid rgba(246, 196, 83, 0.30);
}

.danger-button {
  color: #ffd0c7;
  background: rgba(127, 29, 29, 0.72);
  border: 1px solid rgba(248, 113, 113, 0.38);
}

.publish-button::after,
.secondary-button::after,
.danger-button::after {
  border: 0;
}

.danger-button[disabled] {
  color: rgba(255, 208, 199, 0.58);
  background: rgba(127, 29, 29, 0.38);
}

.switch-note {
  padding: 18rpx 20rpx;
  margin-bottom: 18rpx;
  color: #f7e8b6;
  background: rgba(246, 196, 83, 0.10);
  border: 1px solid rgba(246, 196, 83, 0.24);
  border-radius: 8rpx;
}

.resource-row {
  display: grid;
  grid-template-columns: 164rpx minmax(0, 1fr);
  gap: 18rpx;
  padding: 24rpx;
  margin-bottom: 16rpx;
  background: linear-gradient(145deg, rgba(16, 42, 38, 0.96), rgba(8, 19, 20, 0.98));
  border: 1px solid rgba(246, 196, 83, 0.26);
  border-radius: 8rpx;
  box-shadow: 0 14rpx 32rpx rgba(0, 0, 0, 0.26), inset 0 1rpx 0 rgba(255, 255, 255, 0.10);
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

.resource-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14rpx;
}

.resource-title {
  flex: 1;
  min-width: 0;
  color: #f7e8b6;
  font-size: 30rpx;
  font-weight: 800;
  line-height: 1.35;
}

.status-pill {
  flex: 0 0 auto;
  padding: 5rpx 12rpx;
  color: #071112;
  font-size: 22rpx;
  font-weight: 800;
  line-height: 1.3;
  background: #9ab4a8;
  border-radius: 999rpx;
}

.status-active {
  background: #34d399;
}

.status-closed {
  background: #f6c453;
}

.status-pending_image_review {
  background: #60a5fa;
}

.status-expired {
  color: #fff;
  background: #64748b;
}

.status-removed {
  color: #fff;
  background: #b91c1c;
}

.resource-meta,
.resource-line,
.resource-time {
  margin-top: 8rpx;
  color: #9ab4a8;
  line-height: 1.5;
}

.resource-line:nth-of-type(4) {
  color: #f6c453;
}

.resource-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
  margin-top: 18rpx;
}

.empty,
.load-more {
  padding: 48rpx 0;
  color: #9ab4a8;
  text-align: center;
}
</style>
