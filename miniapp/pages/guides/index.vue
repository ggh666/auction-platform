<template>
  <view class="page">
    <view class="header">
      <view>
        <text class="title">攻略</text>
        <text class="subtitle">常用工具与福利信息</text>
      </view>
      <button class="share-button" open-type="share">分享</button>
    </view>

    <view v-if="hasActivityEntries" class="section-heading">
      <text class="section-kicker">活动</text>
      <text class="section-title">活动入口</text>
    </view>

    <view v-if="hasActivityEntries" class="tool-grid">
      <view v-if="dungeonMaterialImageUrl" class="tool-card" @tap="openDungeonMaterials">
        <view class="tool-mark">材</view>
        <text class="tool-title">活动材料</text>
        <text class="tool-desc">材料图片查看</text>
      </view>
      <view v-if="hasDungeonGuideImages" class="tool-card" @tap="openDungeonGuide">
        <view class="tool-mark">攻</view>
        <text class="tool-title">活动攻略</text>
        <text class="tool-desc">攻略图片查看</text>
      </view>
    </view>

    <view class="section-heading" :class="{ 'section-heading-secondary': hasActivityEntries }">
      <text class="section-kicker">基础</text>
      <text class="section-title">基础功能</text>
    </view>

    <view class="tool-grid">
      <view class="tool-card" @tap="openCardUpgrade">
        <view class="tool-mark">卡</view>
        <text class="tool-title">卡牌升级</text>
        <text class="tool-desc">英雄卡牌升级材料计算</text>
      </view>
      <view class="tool-card" @tap="openSeasonChallenge">
        <view class="tool-mark">赛</view>
        <text class="tool-title">赛季挑战</text>
        <text class="tool-desc">赛季积分与奖章计算</text>
      </view>
    </view>

    <view class="section-heading section-heading-secondary">
      <text class="section-kicker">副本</text>
      <text class="section-title">副本计算</text>
    </view>

    <view class="tool-grid">
      <view class="tool-card" @tap="openDeepSeaBattle">
        <view class="tool-mark">海</view>
        <text class="tool-title">深海之战</text>
        <text class="tool-desc">地图点位与伤害属性计算</text>
      </view>
      <view class="tool-card" @tap="openMaelstrom">
        <view class="tool-mark">涡</view>
        <text class="tool-title">大漩涡</text>
        <text class="tool-desc">关卡Boss属性与伤害公式</text>
      </view>
      <view class="tool-card" @tap="openSkyTower">
        <view class="tool-mark">塔</view>
        <text class="tool-title">天空塔</text>
        <text class="tool-desc">楼层阵容与天空币奖励</text>
      </view>
    </view>

    <view class="section-heading section-heading-secondary">
      <text class="section-kicker">其它</text>
      <text class="section-title">实用入口</text>
    </view>

    <view class="tool-grid">
      <view class="tool-card" @tap="openHealthCalculator">
        <view class="tool-mark">血</view>
        <text class="tool-title">血量计算</text>
        <text class="tool-desc">战车生命加成计算</text>
      </view>
      <view class="tool-card" @tap="openAdditionalCalculator">
        <view class="tool-mark">附</view>
        <text class="tool-title">附加计算</text>
        <text class="tool-desc">附加伤害加成计算</text>
      </view>
      <view class="tool-card" @tap="openCheckIn">
        <view class="tool-mark">签</view>
        <text class="tool-title">签到</text>
        <text class="tool-desc">每日签到福利入口</text>
      </view>
      <view class="tool-card" @tap="openDragonBallSystem">
        <view class="tool-mark">龙</view>
        <text class="tool-title">龙珠体系</text>
        <text class="tool-desc">品质、属性与获取方式</text>
      </view>
      <view class="tool-card" @tap="openRedeemCodes">
        <view class="tool-mark">码</view>
        <text class="tool-title">兑换码</text>
        <text class="tool-desc">礼包码与福利码</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { onShareAppMessage, onShareTimeline, onShow } from "@dcloudio/uni-app";
import { computed, ref } from "vue";
import { getAppConfig } from "../../api/client";
import { buildGuidesShare, toTimelineShare } from "../../utils/share";
import { syncCustomTabBarSelected } from "../../utils/tabBar";

const checkInUrl = ref("");
const dungeonMaterialImageUrl = ref("");
const dungeonGuideImageUrl = ref("");
const dungeonGuideImageUrls = ref<string[]>([]);

const hasDungeonGuideImages = computed(() => dungeonGuideImageUrls.value.length > 0 || Boolean(dungeonGuideImageUrl.value));
const hasActivityEntries = computed(() => Boolean(dungeonMaterialImageUrl.value || hasDungeonGuideImages.value));

onShow(() => {
  syncCustomTabBarSelected(1);
  uni.showShareMenu({ withShareTicket: true, menus: ["shareAppMessage", "shareTimeline"] });
  void loadAppConfig();
});

onShareAppMessage(() => buildGuidesShare());

onShareTimeline(() => toTimelineShare(buildGuidesShare()));

function openDeepSeaBattle() {
  uni.navigateTo({ url: "/pages/guides/deep-sea-battle" });
}

function openMaelstrom() {
  uni.navigateTo({ url: "/pages/guides/maelstrom" });
}

function openSkyTower() {
  uni.navigateTo({ url: "/pages/guides/sky-tower" });
}

function openDungeonMaterials() {
  uni.navigateTo({ url: "/pages/guides/dungeon-materials" });
}

function openDungeonGuide() {
  uni.navigateTo({ url: "/pages/guides/dungeon-guide" });
}

function openCardUpgrade() {
  uni.navigateTo({ url: "/pages/guides/card-upgrade" });
}

function openSeasonChallenge() {
  uni.navigateTo({ url: "/pages/guides/season-challenge" });
}

function openRedeemCodes() {
  uni.navigateTo({ url: "/pages/guides/redeem-codes" });
}

function openHealthCalculator() {
  uni.navigateTo({ url: "/pages/guides/health-calculator" });
}

function openAdditionalCalculator() {
  uni.navigateTo({ url: "/pages/guides/additional-calculator" });
}

function openCheckIn() {
  const url = checkInUrl.value.trim();
  if (!url) {
    uni.showToast({ title: "暂未配置签到入口", icon: "none" });
    return;
  }

  uni.setClipboardData({
    data: url,
    success() {
      uni.showModal({
        title: "签到链接已复制",
        content: "请在微信内打开该链接完成签到。可粘贴到微信聊天或文件传输助手后点击打开。",
        confirmText: "知道了",
        showCancel: false
      });
    },
    fail() {
      uni.showToast({ title: "复制失败，请稍后重试", icon: "none" });
    }
  });
}

function openDragonBallSystem() {
  uni.navigateTo({ url: "/pages/guides/dragon-ball-system" });
}

async function loadAppConfig() {
  try {
    const config = await getAppConfig();
    const guideImageUrls = config.dungeonGuideImageUrls?.map((item) => item.trim()).filter(Boolean) ?? [];
    const guideImageUrl = config.dungeonGuideImageUrl?.trim() ?? "";
    checkInUrl.value = config.checkInUrl?.trim() ?? "";
    dungeonMaterialImageUrl.value = config.dungeonMaterialImageUrl?.trim() ?? "";
    dungeonGuideImageUrls.value = guideImageUrls;
    dungeonGuideImageUrl.value = guideImageUrl || guideImageUrls[0] || "";
  } catch {
    checkInUrl.value = "";
    dungeonMaterialImageUrl.value = "";
    dungeonGuideImageUrl.value = "";
    dungeonGuideImageUrls.value = [];
  }
}
</script>

<style scoped>
.page {
  min-height: 100vh;
  box-sizing: border-box;
  padding: 32rpx 24rpx calc(180rpx + env(safe-area-inset-bottom));
  background:
    linear-gradient(160deg, rgba(15, 118, 110, 0.24), transparent 34%),
    linear-gradient(24deg, rgba(246, 196, 83, 0.18), transparent 42%),
    repeating-linear-gradient(90deg, rgba(245, 240, 220, 0.05) 0, rgba(245, 240, 220, 0.05) 1px, transparent 1px, transparent 48rpx),
    #071112;
}

.title,
.subtitle,
.section-kicker,
.section-title,
.tool-title,
.tool-desc {
  display: block;
}

.header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20rpx;
  margin-bottom: 32rpx;
}

.title {
  color: #f7e8b6;
  font-size: 42rpx;
  font-weight: 800;
  text-shadow: 0 4rpx 18rpx rgba(246, 196, 83, 0.25);
}

.subtitle {
  margin-top: 8rpx;
  color: #9ab4a8;
  font-size: 28rpx;
}

.share-button {
  flex: 0 0 auto;
  height: 60rpx;
  margin: 0;
  padding: 0 20rpx;
  color: #f7e8b6;
  font-size: 26rpx;
  font-weight: 700;
  line-height: 60rpx;
  background: rgba(12, 35, 31, 0.88);
  border: 1px solid rgba(246, 196, 83, 0.34);
  border-radius: 8rpx;
  box-shadow: inset 0 1rpx 0 rgba(255, 255, 255, 0.16);
}

.share-button::after {
  border: 0;
}

.section-heading {
  margin-bottom: 18rpx;
}

.section-heading-secondary {
  margin-top: 32rpx;
}

.section-kicker {
  color: #8df0c7;
  font-size: 24rpx;
  font-weight: 800;
}

.section-title {
  margin-top: 6rpx;
  color: #f7e8b6;
  font-size: 34rpx;
  font-weight: 800;
}

.tool-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14rpx;
}

.tool-card {
  display: flex;
  min-height: 164rpx;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  padding: 18rpx 8rpx 16rpx;
  background: linear-gradient(135deg, rgba(18, 52, 46, 0.96), rgba(9, 22, 22, 0.96));
  border: 1px solid rgba(246, 196, 83, 0.34);
  border-radius: 8rpx;
  box-shadow: 0 18rpx 40rpx rgba(0, 0, 0, 0.32), inset 0 1rpx 0 rgba(255, 255, 255, 0.12);
}

.tool-mark {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 56rpx;
  height: 56rpx;
  margin-bottom: 12rpx;
  color: #1d1605;
  font-size: 24rpx;
  font-weight: 900;
  background: linear-gradient(180deg, #ffe08a, #d99620);
  border-radius: 50%;
  box-shadow: 0 10rpx 24rpx rgba(246, 196, 83, 0.26), inset 0 2rpx 0 rgba(255, 255, 255, 0.36);
}

.tool-title {
  color: #f7e8b6;
  font-size: 24rpx;
  font-weight: 800;
  line-height: 1.2;
  text-align: center;
  word-break: keep-all;
}

.tool-desc {
  display: -webkit-box;
  min-height: 54rpx;
  margin-top: 8rpx;
  overflow: hidden;
  color: #9ab4a8;
  font-size: 18rpx;
  line-height: 1.5;
  text-align: center;
  word-break: break-word;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}
</style>
