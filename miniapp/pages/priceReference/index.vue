<template>
  <view class="page">
    <view class="header">
      <text class="eyebrow">{{ gameName }}</text>
      <text class="title">估值参考</text>
      <text class="summary">按周查看龙珠职业和品质的参考区间。</text>
    </view>

    <view class="panel">
      <view class="panel-heading">
        <view>
          <text class="panel-title">最新周价格参考</text>
          <text v-if="latestBatch" class="panel-desc">{{ latestBatch.weekStartDate }} 至 {{ latestBatch.weekEndDate }}</text>
          <text v-else class="panel-desc">暂无最新价格参考</text>
        </view>
        <button class="ghost-button" :loading="loadingLatest" @tap="loadLatest">刷新</button>
      </view>

      <view v-if="latestItems.length > 0" class="reference-table">
        <view class="table-row table-head">
          <text>职业</text>
          <text>品质</text>
          <text>最低价</text>
          <text>最高价</text>
        </view>
        <view v-for="item in latestItems" :key="item.id" class="table-row">
          <text>{{ item.profession }}</text>
          <text>{{ item.quality }}品质</text>
          <text>{{ priceText(item.minPriceCents) }}</text>
          <text>{{ priceText(item.maxPriceCents) }}</text>
        </view>
      </view>
      <view v-else class="empty-state">暂无价格参考数据</view>
    </view>

    <view class="panel">
      <view class="panel-heading">
        <view>
          <text class="panel-title">趋势</text>
          <text class="panel-desc">选择职业与品质查看最近周参考区间。</text>
        </view>
      </view>

      <view class="selector-grid">
        <view class="field">
          <text class="field-label">职业</text>
          <picker mode="selector" :range="dragonBallPriceReferenceProfessionOptions" :value="selectedProfessionIndex" @change="onProfessionChange">
            <view class="picker-value">{{ selectedProfession }}</view>
          </picker>
        </view>
        <view class="field">
          <text class="field-label">品质</text>
          <picker mode="selector" :range="qualityLabels" :value="selectedQualityIndex" @change="onQualityChange">
            <view class="picker-value">{{ selectedQuality }}品质</view>
          </picker>
        </view>
      </view>

      <view v-if="currentReference" class="current-reference">
        <text>{{ selectedQuality }}品质{{ selectedProfession }}参考：{{ priceText(currentReference.minPriceCents) }} - {{ priceText(currentReference.maxPriceCents) }}</text>
      </view>

      <view v-if="trendRows.length > 0" class="trend-list">
        <view v-for="item in trendRows" :key="`${item.batchId}-${item.weekStartDate}`" class="trend-row">
          <view class="trend-meta">
            <text>{{ item.weekStartDate }}</text>
            <text>{{ item.minPriceText }} - {{ item.maxPriceText }}</text>
          </view>
          <view class="trend-bar">
            <view class="trend-bar-fill" :style="item.barStyle"></view>
          </view>
        </view>
      </view>
      <view v-else class="empty-state">暂无该职业品质趋势</view>
    </view>
  </view>
</template>

<script setup lang="ts">
import {
  centsToYuanText,
  dragonBallPriceReferenceProfessionOptions,
  dragonBallQualityOptions,
  type DragonBallPriceReferenceBatch,
  type DragonBallPriceReferenceItem,
  type DragonBallPriceReferenceTrendItem
} from "@auction/shared";
import { onLoad, onShareAppMessage, onShareTimeline, onShow } from "@dcloudio/uni-app";
import { computed, ref } from "vue";
import { getDragonBallPriceReferenceLatest, getDragonBallPriceReferenceTrend } from "../../api/client";
import { defaultGameName, normalizeGameName } from "../../utils/gameOptions";
import { buildPriceReferenceShare, toTimelineShare } from "../../utils/share";

const gameName = ref(defaultGameName);
const latestBatch = ref<DragonBallPriceReferenceBatch | null>(null);
const trendItems = ref<DragonBallPriceReferenceTrendItem[]>([]);
const selectedProfession = ref(dragonBallPriceReferenceProfessionOptions[0] ?? "战士");
const selectedQuality = ref(dragonBallQualityOptions[dragonBallQualityOptions.length - 1] ?? "红");
const loadingLatest = ref(false);
const loadingTrend = ref(false);
const qualityLabels = dragonBallQualityOptions.map((quality) => `${quality}品质`);

const selectedProfessionIndex = computed(() =>
  Math.max(0, dragonBallPriceReferenceProfessionOptions.findIndex((profession) => profession === selectedProfession.value))
);
const selectedQualityIndex = computed(() =>
  Math.max(0, dragonBallQualityOptions.findIndex((quality) => quality === selectedQuality.value))
);
const latestItems = computed(() => latestBatch.value?.items ?? []);
const currentReference = computed<DragonBallPriceReferenceItem | null>(() => {
  return (
    latestItems.value.find(
      (item) => item.profession === selectedProfession.value && item.quality === selectedQuality.value
    ) ?? null
  );
});
const trendRows = computed(() => {
  const maxPrice = Math.max(...trendItems.value.map((item) => item.maxPriceCents), 0);
  return trendItems.value.map((item) => ({
    ...item,
    minPriceText: priceText(item.minPriceCents),
    maxPriceText: priceText(item.maxPriceCents),
    barStyle: `width: ${trendBarWidth(item.maxPriceCents, maxPrice)};`
  }));
});

onLoad((query) => {
  gameName.value = normalizeGameName(query?.gameName) ?? defaultGameName;
  const professionQuery = typeof query?.profession === "string" ? decodeURIComponent(query.profession).trim() : "";
  const qualityQuery = typeof query?.quality === "string" ? decodeURIComponent(query.quality).trim() : "";
  if (dragonBallPriceReferenceProfessionOptions.some((profession) => profession === professionQuery)) {
    selectedProfession.value = professionQuery as typeof selectedProfession.value;
  }
  if (dragonBallQualityOptions.some((quality) => quality === qualityQuery)) {
    selectedQuality.value = qualityQuery as typeof selectedQuality.value;
  }
  void loadLatest();
  void loadTrend();
});

onShow(() => {
  uni.showShareMenu({ withShareTicket: true, menus: ["shareAppMessage", "shareTimeline"] });
});

onShareAppMessage(() => currentShareTarget());

onShareTimeline(() => toTimelineShare(currentShareTarget()));

function currentShareTarget() {
  return buildPriceReferenceShare({
    gameName: gameName.value,
    profession: selectedProfession.value,
    quality: selectedQuality.value
  });
}

function readPickerIndex(event: { detail?: { value?: unknown } }): number {
  const value = event.detail?.value;
  const index = typeof value === "number" ? value : Number(value);
  return Number.isInteger(index) && index >= 0 ? index : 0;
}

function onProfessionChange(event: { detail?: { value?: unknown } }) {
  selectedProfession.value = dragonBallPriceReferenceProfessionOptions[readPickerIndex(event)] ?? selectedProfession.value;
  void loadTrend();
}

function onQualityChange(event: { detail?: { value?: unknown } }) {
  selectedQuality.value = dragonBallQualityOptions[readPickerIndex(event)] ?? selectedQuality.value;
  void loadTrend();
}

function priceText(value: number): string {
  if (!Number.isSafeInteger(value) || value < 0) {
    return "暂无";
  }
  const safeValue = value;
  return `${centsToYuanText(safeValue)} 元宝`;
}

function trendBarWidth(value: number, maxPrice: number): string {
  if (maxPrice <= 0) {
    return "0%";
  }
  return `${Math.max(8, Math.round((value / maxPrice) * 100))}%`;
}

async function loadLatest() {
  loadingLatest.value = true;
  try {
    const response = await getDragonBallPriceReferenceLatest(gameName.value);
    latestBatch.value = normalizePriceReferenceBatch(response?.batch);
  } catch {
    latestBatch.value = null;
  } finally {
    loadingLatest.value = false;
  }
}

async function loadTrend() {
  loadingTrend.value = true;
  try {
    const response = await getDragonBallPriceReferenceTrend({
      gameName: gameName.value,
      profession: selectedProfession.value,
      quality: selectedQuality.value
    });
    trendItems.value = normalizePriceReferenceTrendItems(response?.items);
  } catch {
    trendItems.value = [];
  } finally {
    loadingTrend.value = false;
  }
}

function normalizePriceReferenceBatch(input: unknown): DragonBallPriceReferenceBatch | null {
  if (!isRecord(input)) {
    return null;
  }
  const items = normalizePriceReferenceItems(input.items);
  return {
    id: readString(input.id),
    gameName: readString(input.gameName),
    weekStartDate: readString(input.weekStartDate),
    weekEndDate: readString(input.weekEndDate),
    note: readString(input.note),
    createdAt: readString(input.createdAt),
    updatedAt: readString(input.updatedAt),
    items
  };
}

function normalizePriceReferenceItems(input: unknown): DragonBallPriceReferenceItem[] {
  if (!Array.isArray(input)) {
    return [];
  }
  return input.flatMap((item) => {
    if (!isRecord(item)) {
      return [];
    }
    const minPriceCents = readSafeCents(item.minPriceCents);
    const maxPriceCents = readSafeCents(item.maxPriceCents);
    if (minPriceCents === null || maxPriceCents === null) {
      return [];
    }
    return [
      {
        id: readString(item.id),
        batchId: readString(item.batchId),
        profession: readString(item.profession) as DragonBallPriceReferenceItem["profession"],
        quality: readString(item.quality) as DragonBallPriceReferenceItem["quality"],
        minPriceCents,
        maxPriceCents,
        createdAt: readString(item.createdAt),
        updatedAt: readString(item.updatedAt)
      }
    ];
  });
}

function normalizePriceReferenceTrendItems(input: unknown): DragonBallPriceReferenceTrendItem[] {
  if (!Array.isArray(input)) {
    return [];
  }
  return input.flatMap((item) => {
    if (!isRecord(item)) {
      return [];
    }
    const minPriceCents = readSafeCents(item.minPriceCents);
    const maxPriceCents = readSafeCents(item.maxPriceCents);
    if (minPriceCents === null || maxPriceCents === null) {
      return [];
    }
    return [
      {
        batchId: readString(item.batchId),
        gameName: readString(item.gameName),
        weekStartDate: readString(item.weekStartDate),
        weekEndDate: readString(item.weekEndDate),
        profession: readString(item.profession) as DragonBallPriceReferenceTrendItem["profession"],
        quality: readString(item.quality) as DragonBallPriceReferenceTrendItem["quality"],
        minPriceCents,
        maxPriceCents
      }
    ];
  });
}

function isRecord(input: unknown): input is Record<string, unknown> {
  return typeof input === "object" && input !== null;
}

function readString(input: unknown): string {
  return typeof input === "string" ? input : "";
}

function readSafeCents(input: unknown): number | null {
  return typeof input === "number" && Number.isSafeInteger(input) && input >= 0 ? input : null;
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
.summary,
.panel-title,
.panel-desc,
.field-label {
  display: block;
}

.header {
  margin-bottom: 20rpx;
}

.eyebrow {
  color: #8aa196;
  font-size: 24rpx;
}

.title {
  margin-top: 8rpx;
  color: #f7e8b6;
  font-size: 40rpx;
  font-weight: 800;
}

.summary {
  margin-top: 8rpx;
  color: #9ab4a8;
}

.panel {
  margin-bottom: 18rpx;
  padding: 24rpx;
  background: rgba(11, 32, 30, 0.96);
  border: 1px solid rgba(45, 212, 191, 0.24);
  border-radius: 8rpx;
}

.panel-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
  margin-bottom: 18rpx;
}

.panel-title {
  color: #f7e8b6;
  font-size: 30rpx;
  font-weight: 800;
}

.panel-desc {
  margin-top: 6rpx;
  color: #9ab4a8;
  font-size: 24rpx;
}

.ghost-button {
  height: 60rpx;
  margin: 0;
  padding: 0 18rpx;
  color: #f7e8b6;
  font-size: 24rpx;
  font-weight: 800;
  line-height: 60rpx;
  background: rgba(7, 17, 18, 0.72);
  border: 1px solid rgba(246, 196, 83, 0.26);
  border-radius: 6rpx;
}

.ghost-button::after {
  border: 0;
}

.reference-table {
  overflow: hidden;
  border: 1px solid rgba(246, 196, 83, 0.16);
  border-radius: 8rpx;
}

.table-row {
  display: grid;
  grid-template-columns: 1fr 1fr 1.2fr 1.2fr;
  gap: 8rpx;
  padding: 16rpx 14rpx;
  color: #f7e8b6;
  font-size: 24rpx;
  border-top: 1px solid rgba(246, 196, 83, 0.12);
}

.table-row:first-child {
  border-top: 0;
}

.table-head {
  color: #f6c453;
  font-weight: 800;
  background: rgba(246, 196, 83, 0.08);
}

.selector-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14rpx;
  margin-bottom: 16rpx;
}

.field-label {
  margin-bottom: 8rpx;
  color: #f6c453;
  font-weight: 800;
}

.picker-value {
  box-sizing: border-box;
  height: 76rpx;
  padding: 0 18rpx;
  color: #f7e8b6;
  line-height: 76rpx;
  background: rgba(7, 17, 18, 0.7);
  border: 1px solid rgba(246, 196, 83, 0.22);
  border-radius: 6rpx;
}

.current-reference {
  margin-bottom: 18rpx;
  padding: 16rpx;
  color: #f7e8b6;
  background: rgba(246, 196, 83, 0.1);
  border: 1px solid rgba(246, 196, 83, 0.22);
  border-radius: 8rpx;
}

.trend-list {
  display: grid;
  gap: 16rpx;
}

.trend-row {
  display: grid;
  gap: 8rpx;
}

.trend-meta {
  display: flex;
  justify-content: space-between;
  gap: 12rpx;
  color: #f7e8b6;
  font-size: 24rpx;
}

.trend-bar {
  height: 16rpx;
  overflow: hidden;
  background: rgba(7, 17, 18, 0.75);
  border-radius: 8rpx;
}

.trend-bar-fill {
  height: 100%;
  background: #f6c453;
  border-radius: 8rpx;
}

.empty-state {
  padding: 28rpx 0;
  color: #9ab4a8;
  text-align: center;
}
</style>
