<template>
  <view class="page">
    <view class="header">
      <view class="header-main">
        <text class="game-name">{{ gameName }}</text>
        <button class="home-button" @tap="goHome">返回主页</button>
      </view>
      <view class="header-actions">
        <button class="share-button" open-type="share">分享</button>
      </view>
    </view>

    <view class="tabs">
      <view
        v-for="type in assetTypes"
        :key="type"
        class="tab"
        :class="{ active: selectedAssetType === type }"
        @tap="selectAssetType(type)"
      >
        <text>{{ type }}</text>
      </view>
    </view>

    <view v-if="unreadNotifications > 0" class="notice" @tap="openNotifications">
      <text class="notice-title">你有 {{ unreadNotifications }} 条未读价格变动提醒</text>
      <text class="notice-action">查看</text>
    </view>

    <view class="toolbar">
      <input
        v-model="keywordInput"
        class="search"
        confirm-type="search"
        placeholder="搜索标题、区服、描述"
        @confirm="submitSearch"
      />
      <button class="search-button" @tap="submitSearch">搜索</button>
      <button v-if="searchKeyword" class="clear-button" @tap="clearSearch">清除</button>
    </view>

    <view class="filter-panel">
      <view class="filter-row">
        <picker
          class="filter-picker"
          mode="selector"
          :range="principalFilterLabels"
          :value="selectedPrincipalIndex"
          @change="onPrincipalFilterChange"
        >
          <view class="filter-chip">
            <text class="filter-label">筛选主理人</text>
            <text class="filter-value">{{ principalFilterText }}</text>
          </view>
        </picker>
        <picker
          v-if="selectedAssetType === '道具'"
          class="filter-picker"
          mode="selector"
          :range="dragonBallProfessionFilterLabels"
          :value="selectedDragonBallProfessionIndex"
          @change="onDragonBallProfessionChange"
        >
          <view class="filter-chip">
            <text class="filter-label">龙珠职业</text>
            <text class="filter-value">{{ dragonBallProfessionFilterText }}</text>
          </view>
        </picker>
        <picker
          v-if="selectedAssetType === '道具'"
          class="filter-picker"
          mode="selector"
          :range="dragonBallQualityFilterLabels"
          :value="selectedDragonBallQualityIndex"
          @change="onDragonBallQualityChange"
        >
          <view class="filter-chip">
            <text class="filter-label">龙珠品质</text>
            <text class="filter-value">{{ dragonBallQualityFilterText }}</text>
          </view>
        </picker>
      </view>
      <button v-if="hasActiveFilters" class="filter-reset" @tap="clearFilters">重置筛选</button>
    </view>
    <text class="search-privacy">隐私说明：搜索词和筛选条件仅用于本次列表查询。</text>

    <view v-if="loading && assets.length === 0" class="empty">正在加载交换宝贝</view>
    <view v-else-if="assets.length === 0" class="empty">暂无匹配的进行中交换</view>

    <view v-for="asset in assets" :key="asset.id" class="asset" :class="{ sold: isSoldAsset(asset) }" @tap="openDetail(asset.id)">
      <view v-if="isSoldAsset(asset)" class="sold-stamp">成交</view>
      <view class="asset-heading">
        <text class="asset-title">{{ asset.title }}</text>
      </view>
      <text class="asset-meta">{{ asset.serverName }} / {{ displayAssetType(asset.assetType) }}</text>
      <text v-if="dragonBallLine(asset)" class="dragon-ball-line">{{ dragonBallLine(asset) }}</text>
      <text v-if="isSoldAsset(asset)" class="sold-line">状态：已成交</text>
      <text v-if="asset.principal" class="principal-line">主理人：{{ asset.principal.displayName }}，线下请联系主理人</text>
      <text class="asset-price">当前价：{{ formatPrice(asset.currentPriceCents ?? asset.startingPriceCents) }} 元宝</text>
      <text class="asset-end-time">截止时间：{{ formatTime(asset.effectiveEndAt) }}</text>
      <view v-if="asset.hasPublishedViolation" class="violation-tags">
        <text v-if="asset.hasPublishedViolation" class="violation-tag">该宝贝关联违规公示</text>
      </view>
    </view>

    <view v-if="assets.length > 0" class="load-more">
      <text>{{ loadingMore ? "加载中" : hasMore ? "上拉加载更多" : "没有更多了" }}</text>
    </view>

  </view>
</template>

<script setup lang="ts">
import {
  centsToYuanText,
  dragonBallProfessionOptions,
  dragonBallQualityOptions,
  type AuctionAsset,
  type PrincipalSummary
} from "@auction/shared";
import { onLoad, onPullDownRefresh, onReachBottom, onShareAppMessage, onShareTimeline, onShow } from "@dcloudio/uni-app";
import { computed, ref } from "vue";
import { listAssets, listNotifications, listPrincipals } from "../../api/client";
import { readToken } from "../../auth/session";
import { assetTypes, normalizeAssetType, type AssetType } from "../../utils/assetType";
import { isSoldAsset } from "../../utils/assetStatusText";
import { buildAssetListShare, toTimelineShare } from "../../utils/share";

type LoadAssetsOptions = {
  reset?: boolean;
};

const gameName = ref("塔防精灵");
const selectedAssetType = ref<AssetType>("账号");
const keywordInput = ref("");
const searchKeyword = ref("");
const loading = ref(false);
const loadingMore = ref(false);
const hasMore = ref(true);
const nextPage = ref(1);
const assets = ref<AuctionAsset[]>([]);
const principalOptions = ref<PrincipalSummary[]>([]);
const selectedPrincipalId = ref("");
const selectedDragonBallProfession = ref("");
const selectedDragonBallQuality = ref("");
const unreadNotifications = ref(0);
const pageSize = 20;
const dragonBallProfessionFilterLabels = ["全部职业", ...dragonBallProfessionOptions];
const dragonBallQualityFilterLabels = ["全部品质", ...dragonBallQualityOptions.map((quality) => `${quality}品质`)];

const principalFilterLabels = computed(() => ["全部主理人", ...principalOptions.value.map((principal) => principal.displayName)]);
const selectedPrincipalIndex = computed(() => {
  const index = principalOptions.value.findIndex((principal) => principal.id === selectedPrincipalId.value);
  return index >= 0 ? index + 1 : 0;
});
const selectedDragonBallProfessionIndex = computed(() => {
  const index = dragonBallProfessionOptions.findIndex((profession) => profession === selectedDragonBallProfession.value);
  return index >= 0 ? index + 1 : 0;
});
const selectedDragonBallQualityIndex = computed(() => {
  const index = dragonBallQualityOptions.findIndex((quality) => quality === selectedDragonBallQuality.value);
  return index >= 0 ? index + 1 : 0;
});
const principalFilterText = computed(() => principalOptions.value[selectedPrincipalIndex.value - 1]?.displayName ?? "全部主理人");
const dragonBallProfessionFilterText = computed(() => selectedDragonBallProfession.value || "全部职业");
const dragonBallQualityFilterText = computed(() =>
  selectedDragonBallQuality.value ? `${selectedDragonBallQuality.value}品质` : "全部品质"
);
const hasActiveFilters = computed(
  () => Boolean(selectedPrincipalId.value) || Boolean(selectedDragonBallProfession.value) || Boolean(selectedDragonBallQuality.value)
);

onLoad((query) => {
  if (typeof query?.gameName === "string" && query.gameName.trim()) {
    gameName.value = decodeURIComponent(query.gameName);
  }
  const queryAssetType = normalizeAssetType(query?.assetType);
  if (queryAssetType) {
    selectedAssetType.value = queryAssetType;
  }
  if (typeof query?.keyword === "string") {
    const keyword = decodeURIComponent(query.keyword).trim();
    keywordInput.value = keyword;
    searchKeyword.value = keyword;
  }
});

onShow(() => {
  uni.showShareMenu({ withShareTicket: true, menus: ["shareAppMessage", "shareTimeline"] });
  void loadPrincipalOptions();
  void loadAssets({ reset: true });
  void refreshUnreadNotifications();
});

onPullDownRefresh(() => {
  void loadAssets({ reset: true }).finally(() => {
    uni.stopPullDownRefresh();
  });
});

onReachBottom(() => {
  if (hasMore.value) {
    void loadAssets();
  }
});

onShareAppMessage(() => currentShareTarget());

onShareTimeline(() => toTimelineShare(currentShareTarget()));

function currentShareTarget() {
  return buildAssetListShare({
    gameName: gameName.value,
    assetType: selectedAssetType.value,
    keyword: searchKeyword.value
  });
}

async function loadAssets(options: LoadAssetsOptions = {}) {
  const reset = options.reset ?? false;
  if (reset) {
    nextPage.value = 1;
    hasMore.value = true;
  }
  if (loading.value || loadingMore.value || (!hasMore.value && !reset)) {
    uni.stopPullDownRefresh();
    return;
  }

  const requestedPage = reset ? 1 : nextPage.value;
  if (requestedPage === 1) {
    loading.value = true;
  } else {
    loadingMore.value = true;
  }

  try {
    const keyword = searchKeyword.value.trim();
    const response = await listAssets({
      gameName: gameName.value,
      assetType: selectedAssetType.value,
      principalId: selectedPrincipalId.value || undefined,
      dragonBallProfession: selectedAssetType.value === "道具" ? selectedDragonBallProfession.value || undefined : undefined,
      dragonBallQuality: selectedAssetType.value === "道具" ? selectedDragonBallQuality.value || undefined : undefined,
      keyword: keyword || undefined,
      page: requestedPage,
      pageSize
    });
    assets.value = reset ? response.items : [...assets.value, ...response.items];
    const responsePage = typeof response.page === "number" ? response.page : requestedPage;
    nextPage.value = responsePage + 1;
    hasMore.value =
      typeof response.hasMore === "boolean" ? response.hasMore : response.nextCursor !== null || response.items.length >= pageSize;
  } catch {
    uni.showToast({ title: "交换列表加载失败", icon: "none" });
  } finally {
    loading.value = false;
    loadingMore.value = false;
    uni.stopPullDownRefresh();
  }
}

async function loadPrincipalOptions() {
  try {
    const response = await listPrincipals();
    principalOptions.value = response.items;
    if (selectedPrincipalId.value && !response.items.some((principal) => principal.id === selectedPrincipalId.value)) {
      selectedPrincipalId.value = "";
    }
  } catch {
    principalOptions.value = [];
  }
}

function readPickerIndex(event: { detail?: { value?: unknown } }): number {
  const value = event.detail?.value;
  const index = typeof value === "number" ? value : Number(value);
  return Number.isInteger(index) && index >= 0 ? index : 0;
}

function onPrincipalFilterChange(event: { detail?: { value?: unknown } }) {
  const index = readPickerIndex(event);
  selectedPrincipalId.value = index === 0 ? "" : principalOptions.value[index - 1]?.id ?? "";
  void loadAssets({ reset: true });
}

function onDragonBallProfessionChange(event: { detail?: { value?: unknown } }) {
  const index = readPickerIndex(event);
  selectedDragonBallProfession.value = index === 0 ? "" : dragonBallProfessionOptions[index - 1] ?? "";
  void loadAssets({ reset: true });
}

function onDragonBallQualityChange(event: { detail?: { value?: unknown } }) {
  const index = readPickerIndex(event);
  selectedDragonBallQuality.value = index === 0 ? "" : dragonBallQualityOptions[index - 1] ?? "";
  void loadAssets({ reset: true });
}

function resetDragonBallFilters() {
  selectedDragonBallProfession.value = "";
  selectedDragonBallQuality.value = "";
}

function clearFilters() {
  selectedPrincipalId.value = "";
  resetDragonBallFilters();
  void loadAssets({ reset: true });
}

function selectAssetType(type: AssetType) {
  if (selectedAssetType.value === type) {
    return;
  }
  selectedAssetType.value = type;
  keywordInput.value = "";
  searchKeyword.value = "";
  if (type !== "道具") {
    resetDragonBallFilters();
  }
  void loadAssets({ reset: true });
}

function submitSearch() {
  searchKeyword.value = keywordInput.value.trim();
  void loadAssets({ reset: true });
}

function clearSearch() {
  keywordInput.value = "";
  searchKeyword.value = "";
  void loadAssets({ reset: true });
}

async function refreshUnreadNotifications() {
  if (!readToken()) {
    unreadNotifications.value = 0;
    return;
  }

  try {
    const response = await listNotifications();
    unreadNotifications.value = response.unreadCount;
  } catch {
    unreadNotifications.value = 0;
  }
}

function formatPrice(cents: number) {
  return centsToYuanText(cents);
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

function openNotifications() {
  uni.navigateTo({ url: "/pages/profile/notifications" });
}

function goHome() {
  uni.switchTab({ url: "/pages/games/index" });
}

</script>

<style scoped>
.page {
  min-height: 100vh;
  padding: 24rpx;
  background: #f6f7f9;
}

.header {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 20rpx;
}

.header-main {
  display: flex;
  flex: 1 1 300rpx;
  align-items: center;
  gap: 14rpx;
  min-width: 0;
}

.game-name {
  flex: 1;
  min-width: 0;
  font-size: 36rpx;
  font-weight: 700;
  color: #101828;
}

.home-button {
  flex: 0 0 auto;
  height: 56rpx;
  margin: 0;
  padding: 0 18rpx;
  font-size: 24rpx;
  line-height: 56rpx;
  color: #175cd3;
  background: #eff8ff;
  border-radius: 8rpx;
}

.header-actions {
  display: flex;
  flex: 0 0 auto;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 12rpx;
}

.share-button {
  height: 64rpx;
  margin: 0;
  padding: 0 20rpx;
  font-size: 26rpx;
  line-height: 64rpx;
  color: #175cd3;
  background: #eff8ff;
  border-radius: 8rpx;
}

.home-button::after,
.share-button::after {
  border: 0;
}

.tabs {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  margin-bottom: 20rpx;
  overflow: hidden;
  background: #fff;
  border: 1px solid #d0d5dd;
  border-radius: 8rpx;
}

.tab {
  height: 72rpx;
  line-height: 72rpx;
  text-align: center;
  color: #475467;
}

.tab.active {
  font-weight: 700;
  color: #fff;
  background: #175cd3;
}

.notice {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20rpx 24rpx;
  margin-bottom: 20rpx;
  background: #fff7ed;
  border: 1px solid #fed7aa;
  border-radius: 8rpx;
}

.notice-title,
.notice-action {
  display: block;
}

.notice-title {
  font-weight: 700;
  color: #9a3412;
}

.notice-action {
  color: #175cd3;
}

.toolbar {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 112rpx auto;
  gap: 12rpx;
  align-items: center;
  margin-bottom: 24rpx;
}

.search {
  box-sizing: border-box;
  width: 100%;
  height: 80rpx;
  padding: 0 20rpx;
  background: #fff;
  border: 1px solid #d0d5dd;
  border-radius: 8rpx;
}

.search-button,
.clear-button {
  height: 80rpx;
  margin: 0;
  padding: 0 18rpx;
  font-size: 26rpx;
  line-height: 80rpx;
  border-radius: 8rpx;
}

.search-button::after,
.clear-button::after {
  border: 0;
}

.search-button {
  color: #fff;
  background: #175cd3;
}

.clear-button {
  color: #344054;
  background: #e4e7ec;
}

.filter-panel {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
  align-items: center;
  margin: -6rpx 0 24rpx;
}

.filter-row {
  display: flex;
  flex: 1 1 100%;
  flex-wrap: wrap;
  gap: 12rpx;
  min-width: 0;
}

.filter-picker {
  flex: 1 1 210rpx;
  min-width: 0;
}

.filter-chip {
  box-sizing: border-box;
  min-height: 72rpx;
  padding: 10rpx 18rpx;
  background: #fff;
  border: 1px solid #d0d5dd;
  border-radius: 8rpx;
}

.filter-label,
.filter-value {
  display: block;
}

.filter-label {
  font-size: 22rpx;
  line-height: 1.2;
  color: #667085;
}

.filter-value {
  margin-top: 4rpx;
  overflow: hidden;
  font-size: 26rpx;
  font-weight: 800;
  line-height: 1.25;
  color: #101828;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.filter-reset {
  flex: 0 0 auto;
  height: 56rpx;
  margin: 0;
  padding: 0 18rpx;
  font-size: 24rpx;
  line-height: 56rpx;
  color: #344054;
  background: #e4e7ec;
  border-radius: 8rpx;
}

.filter-reset::after {
  border: 0;
}

.search-privacy {
  display: block;
  margin: -12rpx 0 24rpx;
  font-size: 24rpx;
  line-height: 1.6;
  color: #667085;
}

.asset {
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

.asset-price {
  margin-top: 12rpx;
  color: #b42318;
}

.asset-end-time {
  margin-top: 8rpx;
  color: #475467;
}

.principal-line {
  margin-top: 8rpx;
  color: #175cd3;
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
    linear-gradient(150deg, rgba(14, 116, 144, 0.20), transparent 30%),
    linear-gradient(22deg, rgba(180, 83, 9, 0.20), transparent 38%),
    repeating-linear-gradient(0deg, rgba(245, 240, 220, 0.045) 0, rgba(245, 240, 220, 0.045) 1px, transparent 1px, transparent 44rpx),
    #071112;
}

.game-name {
  color: #f7e8b6;
  text-shadow: 0 4rpx 18rpx rgba(246, 196, 83, 0.22);
}

.home-button {
  color: #f7e8b6;
  font-weight: 800;
  background: rgba(11, 32, 30, 0.9);
  border: 1px solid rgba(246, 196, 83, 0.32);
}

.share-button {
  color: #f7e8b6;
  background: rgba(11, 32, 30, 0.9);
  border: 1px solid rgba(246, 196, 83, 0.32);
}

.tabs {
  background: rgba(8, 24, 23, 0.92);
  border-color: rgba(246, 196, 83, 0.32);
  box-shadow: inset 0 1rpx 0 rgba(255, 255, 255, 0.10);
}

.tab {
  color: #9ab4a8;
}

.tab.active {
  color: #10201d;
  background: linear-gradient(180deg, #a7f3d0, #4ade80);
}

.notice {
  background: rgba(88, 54, 12, 0.84);
  border-color: rgba(246, 196, 83, 0.42);
}

.notice-title {
  color: #ffd66b;
}

.notice-action {
  color: #9ff3d4;
}

.search {
  color: #f5f0dc;
  background: rgba(8, 24, 23, 0.94);
  border-color: rgba(134, 239, 172, 0.24);
}

.search-button {
  color: #10201d;
  font-weight: 800;
  background: linear-gradient(180deg, #a7f3d0, #34d399);
}

.clear-button {
  color: #d6e6dc;
  background: rgba(22, 47, 43, 0.92);
  border: 1px solid rgba(154, 180, 168, 0.24);
}

.search-privacy {
  color: #9ab4a8;
}

.filter-chip {
  background: rgba(8, 24, 23, 0.94);
  border-color: rgba(134, 239, 172, 0.24);
}

.filter-label {
  color: #9ab4a8;
}

.filter-value {
  color: #f7e8b6;
}

.filter-reset {
  color: #d6e6dc;
  background: rgba(22, 47, 43, 0.92);
  border: 1px solid rgba(154, 180, 168, 0.24);
}

.asset {
  position: relative;
  overflow: hidden;
  background: linear-gradient(145deg, rgba(16, 42, 38, 0.96), rgba(8, 19, 20, 0.98));
  border-color: rgba(246, 196, 83, 0.28);
  box-shadow: 0 16rpx 38rpx rgba(0, 0, 0, 0.30), inset 0 1rpx 0 rgba(255, 255, 255, 0.10);
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

.asset::before {
  position: absolute;
  top: 0;
  left: 0;
  width: 8rpx;
  height: 100%;
  background: linear-gradient(180deg, #f6c453, #2dd4bf);
  content: "";
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

.violation-tag {
  color: #ffd0c7;
  background: rgba(127, 29, 29, 0.72);
  border-color: rgba(248, 113, 113, 0.38);
}
</style>
