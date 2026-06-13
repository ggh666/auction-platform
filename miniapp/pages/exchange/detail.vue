<template>
  <view class="page">
    <view v-if="loading" class="empty">正在加载交换详情</view>
    <view v-else-if="!resource" class="empty">交换资源不存在</view>
    <block v-else>
      <view class="header">
        <text class="eyebrow">{{ resource.gameName }} / {{ resource.serverName || "未填区服" }}</text>
        <view class="title-row">
          <text class="title">{{ resource.title }}</text>
          <button class="share-button" open-type="share">分享资源</button>
        </view>
        <text class="publisher">发布者：{{ resource.publisher?.displayName ?? "用户" }}</text>
      </view>

      <image v-if="resource.imageUrl" class="hero-image" :src="resource.imageUrl" mode="aspectFill" @tap="previewImage" />
      <view v-else class="hero-image hero-image-placeholder">
        <text>暂无图片</text>
      </view>

      <view class="detail-panel">
        <text class="section-title">龙珠信息</text>
        <text class="line">{{ resource.dragonBall.element }}系 / {{ resource.dragonBall.profession }} / {{ resource.dragonBall.quality }}品质</text>
        <text class="line">属性：{{ resource.dragonBall.attributes }}</text>
        <text class="line">参考金额：{{ referenceAmountText(resource.dragonBallAmountCents) }}</text>
      </view>

      <view class="detail-panel">
        <text class="section-title">想换什么</text>
        <text class="line">{{ resource.desiredExchange }}</text>
      </view>

      <view class="detail-panel">
        <text class="section-title">补充说明</text>
        <text class="line">{{ resource.description || "暂无补充说明" }}</text>
      </view>

      <view class="risk-panel">
        <text class="risk-title">交易需谨慎</text>
        <text class="risk-copy">平台仅提供信息展示与站内沟通，不参与、不担保、不托管线下交易或资产交割。</text>
        <text class="risk-copy">请勿提前转账，勿泄露账号密码或验证码，私下交易损失由交易双方自行承担。</text>
      </view>

      <button class="contact-button" :loading="contacting" :disabled="contacting || isOwnResource" @tap="contactPublisher">
        {{ isOwnResource ? "这是你发布的资源" : "打招呼" }}
      </button>
    </block>
  </view>
</template>

<script setup lang="ts">
import { centsToYuanText, type ExchangeResource } from "@auction/shared";
import { onLoad, onShareAppMessage, onShareTimeline, onShow } from "@dcloudio/uni-app";
import { computed, ref } from "vue";
import { createSellerConversation, getExchangeResourceDetail } from "../../api/client";
import { readSessionUser } from "../../auth/session";
import { requireLoginForAction } from "../../utils/authNavigation";
import { buildExchangeResourceDetailShare, toTimelineShare } from "../../utils/share";
import { requestAssetMessageSubscription } from "../../utils/subscribeMessage";

const resourceId = ref("");
const resource = ref<ExchangeResource | null>(null);
const loading = ref(false);
const contacting = ref(false);
const currentUserId = ref(readSessionUser()?.id ?? "");
const isOwnResource = computed(() =>
  Boolean(currentUserId.value && resource.value?.publisherId && currentUserId.value === resource.value.publisherId)
);

onLoad((query) => {
  syncSessionUser();
  const value = query?.resourceId;
  resourceId.value = typeof value === "string" ? value : "";
  uni.showShareMenu({ withShareTicket: true, menus: ["shareAppMessage", "shareTimeline"] });
  void loadDetail();
});

onShow(() => {
  syncSessionUser();
});

onShareAppMessage(() => currentShareTarget());

onShareTimeline(() => toTimelineShare(currentShareTarget()));

function currentShareTarget() {
  return buildExchangeResourceDetailShare({
    resourceId: resourceId.value || resource.value?.id || "",
    title: resource.value?.title,
    gameName: resource.value?.gameName,
    imageUrl: resource.value?.imageUrl
  });
}

async function loadDetail() {
  if (!resourceId.value) {
    return;
  }
  loading.value = true;
  try {
    const response = await getExchangeResourceDetail(resourceId.value);
    resource.value = response.resource;
  } catch {
    resource.value = null;
    uni.showToast({ title: "详情加载失败", icon: "none" });
  } finally {
    loading.value = false;
  }
}

function syncSessionUser() {
  currentUserId.value = readSessionUser()?.id ?? "";
}

function referenceAmountText(value: number | null) {
  return value === null ? "未填写参考金额" : `${centsToYuanText(value)} 元宝`;
}

function previewImage() {
  if (!resource.value?.imageUrl) {
    return;
  }
  uni.previewImage({ urls: [resource.value.imageUrl], current: resource.value.imageUrl });
}

function confirmRiskNotice(): Promise<boolean> {
  return new Promise((resolve) => {
    uni.showModal({
      title: "交易需谨慎",
      content:
        "平台仅提供信息展示与站内沟通，不参与、不担保、不托管线下交易或资产交割。请勿提前转账，勿泄露账号密码或验证码，私下交易损失由交易双方自行承担。",
      confirmText: "继续联系",
      cancelText: "取消",
      success(result) {
        resolve(Boolean(result.confirm));
      },
      fail() {
        resolve(false);
      }
    });
  });
}

async function contactPublisher() {
  if (contacting.value || !resource.value) {
    return;
  }
  if (!requireLoginForAction("登录后打招呼")) {
    return;
  }
  if (isOwnResource.value) {
    uni.showToast({ title: "这是你发布的资源，不能联系自己", icon: "none" });
    return;
  }
  const confirmed = await confirmRiskNotice();
  if (!confirmed) {
    return;
  }
  contacting.value = true;
  try {
    await requestAssetMessageSubscription();
    const response = await createSellerConversation(resource.value.id);
    uni.navigateTo({ url: `/pages/profile/asset-chat?conversationId=${response.conversation.id}` });
  } catch (error) {
    uni.showToast({ title: error instanceof Error && error.message.trim() ? error.message : "联系失败", icon: "none" });
  } finally {
    contacting.value = false;
  }
}
</script>

<style scoped>
.page {
  min-height: 100vh;
  padding: 32rpx 24rpx calc(48rpx + env(safe-area-inset-bottom));
  background:
    linear-gradient(145deg, rgba(20, 184, 166, 0.16), transparent 34%),
    linear-gradient(26deg, rgba(246, 196, 83, 0.14), transparent 44%),
    #071112;
}

.eyebrow,
.title,
.publisher,
.section-title,
.line,
.risk-title,
.risk-copy {
  display: block;
}

.header {
  margin-bottom: 20rpx;
}

.hero-image {
  width: 100%;
  height: 420rpx;
  margin-bottom: 18rpx;
  background: rgba(7, 17, 18, 0.7);
  border-radius: 8rpx;
}

.hero-image-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  color: #8aa196;
  font-weight: 800;
  border: 1px dashed rgba(246, 196, 83, 0.28);
}

.title-row {
  display: flex;
  align-items: flex-start;
  gap: 16rpx;
  margin: 8rpx 0;
}

.eyebrow,
.publisher {
  color: #8aa196;
}

.title {
  flex: 1;
  min-width: 0;
  color: #f7e8b6;
  font-size: 38rpx;
  font-weight: 800;
  line-height: 1.3;
}

.share-button {
  flex: 0 0 auto;
  height: 56rpx;
  margin: 0;
  padding: 0 18rpx;
  color: #f7e8b6;
  font-size: 24rpx;
  font-weight: 800;
  line-height: 56rpx;
  background: rgba(11, 32, 30, 0.9);
  border: 1px solid rgba(246, 196, 83, 0.32);
  border-radius: 8rpx;
}

.share-button::after {
  border: 0;
}

.detail-panel,
.risk-panel {
  padding: 22rpx;
  margin-bottom: 16rpx;
  background: rgba(11, 32, 30, 0.96);
  border: 1px solid rgba(45, 212, 191, 0.24);
  border-radius: 8rpx;
}

.risk-panel {
  border-color: rgba(246, 196, 83, 0.32);
}

.section-title,
.risk-title {
  color: #f6c453;
  font-weight: 800;
}

.line,
.risk-copy {
  margin-top: 10rpx;
  color: #d7ebe2;
  line-height: 1.55;
}

.contact-button {
  height: 84rpx;
  margin: 28rpx 0 0;
  color: #071112;
  font-size: 28rpx;
  font-weight: 800;
  line-height: 84rpx;
  background: #f6c453;
  border-radius: 8rpx;
}

.contact-button::after {
  border: 0;
}

.contact-button[disabled] {
  color: #8aa196;
  background: rgba(138, 161, 150, 0.18);
}

.empty {
  padding: 120rpx 0;
  color: #9ab4a8;
  text-align: center;
}
</style>
