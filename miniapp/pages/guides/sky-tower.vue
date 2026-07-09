<template>
  <view class="page">
    <view class="hero">
      <view>
        <text class="hero-kicker">副本计算</text>
        <text class="hero-title">天空塔</text>
        <text class="hero-subtitle">楼层阵容与战术备注</text>
        <text v-if="loading" class="hero-status">正在加载配置...</text>
        <text v-else-if="loadError" class="hero-status error">{{ loadError }}</text>
      </view>
      <button class="share-button" open-type="share">分享</button>
    </view>

    <view class="page-tabs">
      <view
        v-for="pageItem in skyTowerFloorPages"
        :key="pageItem.page"
        class="page-tab"
        :class="{ active: pageItem.page === currentPage }"
        @tap="switchPage(pageItem.page)"
      >
        {{ pageItem.label }}
      </view>
    </view>

    <view class="floor-selector">
      <view
        v-for="floor in currentPageFloors"
        :key="floor"
        class="floor-chip"
        :class="{ active: floor === selectedFloor, elite: floor % 10 === 0 }"
        @tap="selectFloor(floor)"
      >
        <text>{{ floor }}</text>
        <text>{{ floor % 10 === 0 ? "精英" : "普通" }}</text>
      </view>
    </view>

    <view class="floor-card">
      <view class="floor-header">
        <view>
          <text class="floor-kicker">第 {{ floorInfo.floor }} 层</text>
          <text class="floor-title">{{ floorInfo.type === "elite" ? "精英关卡" : "普通关卡" }}</text>
          <text v-if="floorInfo.formationSummary === missingDataLabel" class="placeholder-pill">{{ missingDataLabel }}</text>
        </view>
        <view class="reward-badge">
          <text>{{ floorInfo.rewardAmount }}</text>
          <text>天空币</text>
        </view>
      </view>

      <view class="info-section reward-section">
        <view class="section-title">
          <text class="title-bar"></text>
          <text>奖励信息</text>
        </view>
        <view class="reward-line">
          <text>{{ floorInfo.rewardDesc }}</text>
          <text>{{ floorInfo.rewardAmount }} 天空币</text>
        </view>
      </view>

      <view class="info-section">
        <view class="section-title">
          <text class="title-bar"></text>
          <text>阵容说明</text>
        </view>
        <text class="summary">{{ floorInfo.formationSummary }}</text>

        <view class="lineup-board">
          <view class="lineup-side left">
            <view class="lineup-heading">
              <text>左车</text>
              <text>{{ floorInfo.frontChariot.join("、") }}</text>
            </view>
            <view class="lineup-slots">
              <view v-for="slot in leftHeroSlots" :key="`${slot.position}-${slot.name}`" class="lineup-slot" :class="slot.quality">
                <text class="slot-position">{{ slot.position }}</text>
                <text class="slot-name">{{ slot.name }}</text>
              </view>
            </view>
          </view>
          <view class="lineup-side right">
            <view class="lineup-heading">
              <text>右车</text>
              <text>{{ floorInfo.backChariot.join("、") }}</text>
            </view>
            <view class="lineup-slots">
              <view v-for="slot in rightHeroSlots" :key="`${slot.position}-${slot.name}`" class="lineup-slot" :class="slot.quality">
                <text class="slot-position">{{ slot.position }}</text>
                <text class="slot-name">{{ slot.name }}</text>
              </view>
            </view>
          </view>
        </view>

        <view v-if="otherHeroSlots.length > 0" class="other-slots">
          <text class="other-title">其他英雄</text>
          <view class="other-slot-grid">
            <view v-for="slot in otherHeroSlots" :key="`${slot.position}-${slot.name}`" class="lineup-slot compact" :class="slot.quality">
              <text class="slot-position">{{ slot.position }}</text>
              <text class="slot-name">{{ slot.name }}</text>
            </view>
          </view>
        </view>
      </view>

      <view class="info-section">
        <view class="section-title">
          <text class="title-bar"></text>
          <text>战术备注</text>
        </view>
        <view class="tactic-list">
          <view class="tactic-item">
            <text class="tactic-label">战术</text>
            <text class="tactic-content">{{ tacticSummary }}</text>
          </view>
        </view>
      </view>
    </view>

  </view>
</template>

<script setup lang="ts">
import {
  normalizeSkyTowerFloor,
  skyTowerFloorPages,
  skyTowerFloors as defaultSkyTowerFloors,
  type SkyTowerFloorInfo,
  type SkyTowerHeroSlot
} from "@auction/shared";
import { onLoad, onShareAppMessage, onShareTimeline, onShow } from "@dcloudio/uni-app";
import { computed, ref } from "vue";
import { getSkyTowerConfig } from "../../api/client";
import { buildSkyTowerShare, toTimelineShare } from "../../utils/share";

const selectedFloor = ref(1);
const currentPage = ref(1);
const floors = ref<SkyTowerFloorInfo[]>([...defaultSkyTowerFloors]);
const loading = ref(false);
const loadError = ref("");
const missingDataLabel = "资料待补充";

const floorInfo = computed(
  () =>
    floors.value.find((item) => item.floor === selectedFloor.value) ??
    defaultSkyTowerFloors[normalizeSkyTowerFloor(selectedFloor.value) - 1] ??
    defaultSkyTowerFloors[0]
);
const currentPageFloors = computed(() => skyTowerFloorPages.find((item) => item.page === currentPage.value)?.floors ?? []);
const leftHeroSlots = computed(() => heroSlotsForSide("left"));
const rightHeroSlots = computed(() => heroSlotsForSide("right"));
const otherHeroSlots = computed(() =>
  floorInfo.value.heroSlots.filter((slot) => !isSidePosition(slot.position, "left") && !isSidePosition(slot.position, "right"))
);
const tacticSummary = computed(() => floorInfo.value.tactics.join("；"));

onLoad((query) => {
  const floor = normalizeSkyTowerFloor(Number(query?.floor));
  selectedFloor.value = floor;
  currentPage.value = pageForFloor(floor);
  void loadSkyTowerConfig();
});

onShow(() => {
  uni.showShareMenu({ withShareTicket: true, menus: ["shareAppMessage", "shareTimeline"] });
});

onShareAppMessage(() => buildSkyTowerShare(selectedFloor.value));

onShareTimeline(() => toTimelineShare(buildSkyTowerShare(selectedFloor.value)));

function switchPage(page: number) {
  currentPage.value = page;
  const firstFloor = skyTowerFloorPages.find((item) => item.page === page)?.floors[0] ?? 1;
  selectFloor(firstFloor);
}

function selectFloor(floor: number) {
  selectedFloor.value = normalizeSkyTowerFloor(floor);
  currentPage.value = pageForFloor(selectedFloor.value);
}

function pageForFloor(floor: number): number {
  return Math.ceil(normalizeSkyTowerFloor(floor) / 10);
}

function heroSlotsForSide(side: "left" | "right"): SkyTowerHeroSlot[] {
  return floorInfo.value.heroSlots
    .filter((slot) => isSidePosition(slot.position, side))
    .sort((left, right) => positionNumber(left.position) - positionNumber(right.position));
}

function isSidePosition(position: string, side: "left" | "right"): boolean {
  const normalized = position.trim();
  return side === "left" ? /^(左|前车)\d+/.test(normalized) : /^(右|后车)\d+/.test(normalized);
}

function positionNumber(position: string): number {
  const match = position.match(/\d+/);
  return match ? Number(match[0]) : 999;
}

async function loadSkyTowerConfig() {
  loading.value = true;
  loadError.value = "";
  try {
    const response = await getSkyTowerConfig();
    floors.value = response.floors.length > 0 ? response.floors : [...defaultSkyTowerFloors];
  } catch {
    loadError.value = "加载失败，已使用本地默认资料";
    floors.value = [...defaultSkyTowerFloors];
    uni.showToast({ title: loadError.value, icon: "none" });
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.page {
  min-height: 100vh;
  box-sizing: border-box;
  padding: 24rpx 24rpx calc(44rpx + env(safe-area-inset-bottom));
  background:
    linear-gradient(160deg, rgba(15, 118, 110, 0.24), transparent 34%),
    linear-gradient(24deg, rgba(246, 196, 83, 0.18), transparent 42%),
    repeating-linear-gradient(90deg, rgba(245, 240, 220, 0.05) 0, rgba(245, 240, 220, 0.05) 1px, transparent 1px, transparent 48rpx),
    #071112;
}

.hero {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20rpx;
  margin-bottom: 22rpx;
}

.hero-kicker,
.hero-title,
.hero-subtitle,
.floor-kicker,
.floor-title,
.reward-badge text,
.section-title text,
.summary,
.lineup-heading text,
.slot-position,
.slot-name,
.other-title,
.tactic-label,
.tactic-content {
  display: block;
}

.hero-kicker {
  color: #8df0c7;
  font-size: 24rpx;
  font-weight: 800;
}

.hero-title {
  margin-top: 6rpx;
  color: #f7e8b6;
  font-size: 42rpx;
  font-weight: 900;
  text-shadow: 0 4rpx 18rpx rgba(246, 196, 83, 0.25);
}

.hero-subtitle {
  margin-top: 8rpx;
  color: #9ab4a8;
  font-size: 24rpx;
  font-weight: 700;
}

.hero-status {
  margin-top: 8rpx;
  color: #8df0c7;
  font-size: 21rpx;
  font-weight: 800;
}

.hero-status.error {
  color: #f6c453;
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
}

.share-button::after {
  border: 0;
}

.page-tabs {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12rpx;
  margin-bottom: 16rpx;
}

.page-tab {
  min-width: 0;
  height: 64rpx;
  color: #9ab4a8;
  font-size: 22rpx;
  font-weight: 900;
  line-height: 64rpx;
  text-align: center;
  background: rgba(10, 28, 26, 0.78);
  border: 1px solid rgba(246, 196, 83, 0.22);
  border-radius: 8rpx;
}

.page-tab.active {
  color: #1d1605;
  background: linear-gradient(180deg, #ffe08a, #d99620);
  border-color: rgba(255, 224, 138, 0.7);
}

.floor-selector {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 12rpx;
  margin-bottom: 18rpx;
}

.floor-chip {
  display: flex;
  min-height: 86rpx;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #d9eadf;
  background: linear-gradient(135deg, rgba(18, 52, 46, 0.96), rgba(9, 22, 22, 0.96));
  border: 1px solid rgba(246, 196, 83, 0.28);
  border-radius: 8rpx;
  box-shadow: inset 0 1rpx 0 rgba(255, 255, 255, 0.08);
}

.floor-chip text:first-child {
  font-size: 30rpx;
  font-weight: 900;
}

.floor-chip text:last-child {
  margin-top: 4rpx;
  color: #8aa196;
  font-size: 18rpx;
  font-weight: 800;
}

.floor-chip.active {
  border-color: rgba(246, 196, 83, 0.82);
  box-shadow: 0 0 0 2rpx rgba(246, 196, 83, 0.16), 0 14rpx 30rpx rgba(0, 0, 0, 0.26);
}

.floor-chip.elite text:first-child {
  color: #f6c453;
}

.floor-card {
  padding: 22rpx;
  margin-bottom: 18rpx;
  background: rgba(10, 28, 26, 0.78);
  border: 1px solid rgba(246, 196, 83, 0.24);
  border-radius: 8rpx;
  box-shadow: 0 14rpx 32rpx rgba(0, 0, 0, 0.24), inset 0 1rpx 0 rgba(255, 255, 255, 0.08);
}

.floor-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18rpx;
  margin-bottom: 20rpx;
}

.floor-kicker {
  color: #8df0c7;
  font-size: 24rpx;
  font-weight: 900;
}

.floor-title {
  margin-top: 6rpx;
  color: #f7e8b6;
  font-size: 34rpx;
  font-weight: 900;
}

.placeholder-pill {
  display: inline-block;
  margin-top: 12rpx;
  padding: 6rpx 14rpx;
  color: #8df0c7;
  font-size: 20rpx;
  font-weight: 900;
  background: rgba(141, 240, 199, 0.1);
  border: 1px solid rgba(141, 240, 199, 0.28);
  border-radius: 8rpx;
}

.reward-badge {
  flex: 0 0 132rpx;
  padding: 14rpx 10rpx;
  text-align: center;
  background: rgba(246, 196, 83, 0.14);
  border: 1px solid rgba(246, 196, 83, 0.36);
  border-radius: 8rpx;
}

.reward-badge text:first-child {
  color: #f6c453;
  font-size: 38rpx;
  font-weight: 900;
}

.reward-badge text:last-child {
  margin-top: 2rpx;
  color: #9ab4a8;
  font-size: 20rpx;
  font-weight: 800;
}

.info-section {
  padding-top: 20rpx;
  margin-top: 20rpx;
  border-top: 1px solid rgba(246, 196, 83, 0.16);
}

.reward-section {
  margin-top: 0;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 12rpx;
  margin-bottom: 16rpx;
  color: #f7e8b6;
  font-size: 28rpx;
  font-weight: 900;
}

.title-bar {
  width: 6rpx;
  height: 30rpx;
  background: linear-gradient(180deg, #8df0c7, #f6c453);
  border-radius: 999rpx;
}

.reward-line {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
  color: #d9eadf;
  font-size: 26rpx;
  font-weight: 800;
}

.summary {
  color: #d9eadf;
  font-size: 26rpx;
  font-weight: 800;
  line-height: 1.55;
}

.lineup-board,
.lineup-slots,
.other-slot-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14rpx;
  margin-top: 16rpx;
}

.lineup-board {
  align-items: start;
}

.lineup-side {
  min-width: 0;
}

.lineup-heading {
  display: flex;
  min-height: 0;
  align-items: center;
  gap: 10rpx;
  padding: 10rpx 12rpx;
  background: rgba(246, 196, 83, 0.12);
  border: 1px solid rgba(246, 196, 83, 0.36);
  border-radius: 8rpx;
}

.lineup-side.left .lineup-heading {
  background: rgba(248, 113, 88, 0.14);
  border-color: rgba(248, 113, 88, 0.38);
}

.lineup-side.right .lineup-heading {
  background: rgba(16, 135, 112, 0.22);
  border-color: rgba(141, 240, 199, 0.26);
}

.lineup-heading text:first-child {
  flex: 0 0 auto;
  color: #f7e8b6;
  font-size: 22rpx;
  font-weight: 900;
}

.lineup-side.left .lineup-heading text:first-child {
  color: #fb8b76;
}

.lineup-side.right .lineup-heading text:first-child {
  color: #8df0c7;
}

.lineup-heading text:last-child {
  overflow: hidden;
  flex: 1 1 auto;
  min-width: 0;
  margin-top: 0;
  color: #d9eadf;
  font-size: 22rpx;
  font-weight: 900;
  line-height: 1.2;
  text-align: right;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.lineup-slots {
  gap: 10rpx;
  margin-top: 10rpx;
}

.lineup-slot {
  min-width: 0;
  padding: 18rpx;
  background: rgba(18, 52, 46, 0.72);
  border: 1px solid rgba(246, 196, 83, 0.16);
  border-radius: 8rpx;
}

.lineup-slot {
  min-height: 96rpx;
  padding: 14rpx;
}

.lineup-side.left .lineup-slot {
  background: rgba(248, 113, 88, 0.18);
  border-color: rgba(248, 113, 88, 0.34);
}

.lineup-side.right .lineup-slot {
  background: rgba(16, 135, 112, 0.32);
  border-color: rgba(141, 240, 199, 0.24);
}

.slot-position {
  color: #8df0c7;
  font-size: 22rpx;
  font-weight: 900;
}

.slot-name {
  margin-top: 8rpx;
  color: #d9eadf;
  font-size: 24rpx;
  font-weight: 800;
  line-height: 1.45;
}

.lineup-slot.yellow .slot-name {
  color: #f6c453;
}

.lineup-slot.green .slot-name {
  color: #8df0c7;
}

.lineup-slot.orange .slot-name {
  color: #f59e0b;
}

.lineup-slot.unknown .slot-name {
  color: #9ab4a8;
}

.other-slots {
  margin-top: 16rpx;
}

.other-title {
  color: #9ab4a8;
  font-size: 22rpx;
  font-weight: 900;
}

.other-slot-grid {
  margin-top: 10rpx;
}

.lineup-slot.compact {
  min-height: auto;
  background: rgba(18, 52, 46, 0.72);
}

.tactic-list {
  display: block;
}

.tactic-item {
  display: flex;
  min-width: 0;
  align-items: baseline;
  gap: 12rpx;
  padding: 14rpx 16rpx;
  background: linear-gradient(90deg, rgba(246, 196, 83, 0.12), rgba(18, 52, 46, 0.42));
  border: 1px solid rgba(246, 196, 83, 0.2);
  border-radius: 8rpx;
}

.tactic-label {
  flex: 0 0 auto;
  color: #f6c453;
  font-size: 23rpx;
  font-weight: 900;
}

.tactic-content {
  flex: 1 1 auto;
  min-width: 0;
  color: #d9eadf;
  font-size: 24rpx;
  font-weight: 800;
  line-height: 1.55;
}

</style>
