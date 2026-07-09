<template>
  <view class="page">
    <view class="result-panel">
      <view>
        <text class="kicker">基础功能</text>
        <text class="title">赛季挑战</text>
        <text class="subtitle">本地记录挑战进度，自动计算赛季积分与奖章</text>
      </view>
      <view class="result-main">
        <text class="result-number">{{ result.totalPoints }}</text>
        <text class="result-label">总积分</text>
      </view>
    </view>

    <view class="metric-grid">
      <view class="metric-card">
        <text class="metric-value">{{ result.totalPoints }}</text>
        <text class="metric-label">总积分</text>
      </view>
      <view class="metric-card medal">
        <text class="metric-value">{{ result.medals }}</text>
        <text class="metric-label">奖章</text>
      </view>
    </view>

    <view class="catalog-card">
      <text class="catalog-title">挑战分类</text>
      <text class="catalog-text">{{ sectionTitleLabelText }}</text>
    </view>

    <view class="section-list">
      <view v-for="section in sectionRows" :key="section.id" class="challenge-section">
        <view class="section-header" @tap="toggleSection(section.id)">
          <view class="section-copy">
            <text class="section-title">{{ section.title }}</text>
            <text class="section-desc">{{ section.description }}</text>
          </view>
          <view class="section-status">
            <text class="section-points">{{ section.points }} 分</text>
            <text class="section-count">{{ section.selectedCount }}/{{ section.steps.length }}</text>
          </view>
          <text class="section-arrow" :class="{ open: openSection === section.id }">⌄</text>
        </view>

        <view v-if="openSection === section.id" class="step-grid">
          <view
            v-for="step in section.steps"
            :key="step.value"
            class="step-chip"
            :class="{ active: isStepSelected(section.id, step.value) }"
            @tap.stop="toggleSeasonChallengeStep(section.id, step.value)"
          >
            <text class="step-label">{{ step.label }}</text>
            <text class="step-points">+{{ step.points }}</text>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { onShareAppMessage, onShareTimeline, onShow } from "@dcloudio/uni-app";
import { computed, ref } from "vue";
import {
  calculateSeasonChallenge,
  defaultSeasonChallengeProgress,
  normalizeSeasonChallengeProgress,
  seasonChallengeSections,
  toggleSeasonChallengeStep as applySeasonChallengeStep,
  type SeasonChallengeProgress,
  type SeasonChallengeSectionId
} from "@auction/shared";
import { buildSeasonChallengeShare, toTimelineShare } from "../../utils/share";

const PROGRESS_STORAGE_KEY = "guideSeasonChallengeProgress";
const OPEN_SECTION_STORAGE_KEY = "guideSeasonChallengeOpenSection";
const sectionTitleLabels = ["连胜", "熟练度", "寒冰堡", "英雄等级", "大航海", "合作", "最高杯", "登录天数", "充值"];

const progress = ref<SeasonChallengeProgress>(cloneSeasonChallengeProgress(defaultSeasonChallengeProgress));
const openSection = ref<SeasonChallengeSectionId | "">("winStreak");

const result = computed(() => calculateSeasonChallenge(progress.value));
const sectionTitleLabelText = computed(() => sectionTitleLabels.join(" / "));
const sectionRows = computed(() =>
  seasonChallengeSections.map((section) => ({
    ...section,
    points: result.value.sectionPoints[section.id],
    selectedCount: result.value.progress[section.id].length
  }))
);

onShow(() => {
  uni.showShareMenu({ withShareTicket: true, menus: ["shareAppMessage", "shareTimeline"] });
  loadSeasonChallengeProgress();
});

onShareAppMessage(() => buildSeasonChallengeShare());

onShareTimeline(() => toTimelineShare(buildSeasonChallengeShare()));

function toggleSection(sectionId: SeasonChallengeSectionId) {
  openSection.value = openSection.value === sectionId ? "" : sectionId;
  uni.setStorageSync(OPEN_SECTION_STORAGE_KEY, openSection.value);
}

function toggleSeasonChallengeStep(sectionId: SeasonChallengeSectionId, stepValue: string) {
  progress.value = applySeasonChallengeStep(progress.value, sectionId, stepValue);
  saveSeasonChallengeProgress();
}

function isStepSelected(sectionId: SeasonChallengeSectionId, stepValue: string): boolean {
  return result.value.progress[sectionId].includes(stepValue);
}

function loadSeasonChallengeProgress() {
  try {
    const storedProgress = uni.getStorageSync(PROGRESS_STORAGE_KEY);
    progress.value =
      storedProgress && typeof storedProgress === "object" && !Array.isArray(storedProgress)
        ? normalizeSeasonChallengeProgress(storedProgress as Partial<Record<SeasonChallengeSectionId, unknown>>)
        : cloneSeasonChallengeProgress(defaultSeasonChallengeProgress);

    const storedOpenSection = String(uni.getStorageSync(OPEN_SECTION_STORAGE_KEY) ?? "");
    if (isSeasonChallengeSectionId(storedOpenSection)) {
      openSection.value = storedOpenSection;
    }
  } catch {
    progress.value = cloneSeasonChallengeProgress(defaultSeasonChallengeProgress);
    openSection.value = "winStreak";
  }
}

function saveSeasonChallengeProgress() {
  uni.setStorageSync(PROGRESS_STORAGE_KEY, cloneSeasonChallengeProgress(progress.value));
}

function isSeasonChallengeSectionId(value: string): value is SeasonChallengeSectionId {
  return seasonChallengeSections.some((section) => section.id === value);
}

function cloneSeasonChallengeProgress(input: SeasonChallengeProgress): SeasonChallengeProgress {
  return seasonChallengeSections.reduce((accumulator, section) => {
    accumulator[section.id] = [...input[section.id]];
    return accumulator;
  }, {} as SeasonChallengeProgress);
}
</script>

<style scoped>
.page {
  min-height: 100vh;
  box-sizing: border-box;
  padding: 24rpx 24rpx calc(48rpx + env(safe-area-inset-bottom));
  background:
    linear-gradient(160deg, rgba(15, 118, 110, 0.24), transparent 34%),
    linear-gradient(24deg, rgba(246, 196, 83, 0.18), transparent 42%),
    repeating-linear-gradient(90deg, rgba(245, 240, 220, 0.05) 0, rgba(245, 240, 220, 0.05) 1px, transparent 1px, transparent 48rpx),
    #071112;
}

.result-panel,
.metric-card,
.catalog-card,
.challenge-section {
  border: 1px solid rgba(246, 196, 83, 0.34);
  border-radius: 8rpx;
  background: linear-gradient(135deg, rgba(14, 45, 40, 0.94), rgba(8, 22, 22, 0.96));
  box-shadow: 0 18rpx 40rpx rgba(0, 0, 0, 0.28), inset 0 1rpx 0 rgba(255, 255, 255, 0.1);
}

.result-panel {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20rpx;
  padding: 24rpx;
  margin-bottom: 18rpx;
}

.kicker,
.title,
.subtitle,
.result-number,
.result-label,
.metric-value,
.metric-label,
.catalog-title,
.catalog-text,
.section-title,
.section-desc,
.section-points,
.section-count,
.step-label,
.step-points {
  display: block;
}

.kicker {
  color: #8df0c7;
  font-size: 24rpx;
  font-weight: 800;
}

.title {
  margin-top: 8rpx;
  color: #f7e8b6;
  font-size: 42rpx;
  font-weight: 900;
}

.subtitle,
.result-label,
.metric-label,
.catalog-text,
.section-desc,
.section-count {
  color: #9ab4a8;
  font-size: 24rpx;
  font-weight: 700;
}

.subtitle,
.result-label,
.metric-label,
.catalog-text {
  margin-top: 8rpx;
}

.result-main {
  flex: 0 0 auto;
  min-width: 170rpx;
  text-align: right;
}

.result-number {
  color: #ffcc4d;
  font-size: 58rpx;
  font-weight: 900;
  line-height: 1;
}

.metric-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18rpx;
  margin-bottom: 18rpx;
}

.metric-card {
  padding: 22rpx 24rpx;
}

.metric-card.medal {
  background: linear-gradient(135deg, rgba(68, 45, 12, 0.78), rgba(8, 22, 22, 0.96));
}

.metric-value {
  color: #f7e8b6;
  font-size: 40rpx;
  font-weight: 900;
}

.catalog-card {
  padding: 22rpx 24rpx;
  margin-bottom: 18rpx;
}

.catalog-title {
  color: #f7e8b6;
  font-size: 28rpx;
  font-weight: 900;
}

.catalog-text {
  line-height: 1.45;
}

.section-list {
  display: grid;
  gap: 18rpx;
}

.challenge-section {
  overflow: hidden;
}

.section-header {
  position: relative;
  display: flex;
  align-items: center;
  gap: 18rpx;
  padding: 22rpx 74rpx 22rpx 24rpx;
}

.section-copy {
  flex: 1 1 auto;
  min-width: 0;
}

.section-title {
  color: #f7e8b6;
  font-size: 30rpx;
  font-weight: 900;
}

.section-desc {
  margin-top: 6rpx;
  line-height: 1.35;
}

.section-status {
  flex: 0 0 auto;
  text-align: right;
}

.section-points {
  color: #ffcc4d;
  font-size: 28rpx;
  font-weight: 900;
}

.section-arrow {
  position: absolute;
  right: 24rpx;
  top: 50%;
  color: #8df0c7;
  font-size: 36rpx;
  font-weight: 900;
  line-height: 1;
  transform: translateY(-50%);
  transition: transform 0.18s ease;
}

.section-arrow.open {
  transform: translateY(-50%) rotate(180deg);
}

.step-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14rpx;
  padding: 0 24rpx 24rpx;
}

.step-chip {
  min-height: 76rpx;
  box-sizing: border-box;
  padding: 14rpx 16rpx;
  background: rgba(8, 30, 28, 0.78);
  border: 1px solid rgba(154, 180, 168, 0.26);
  border-radius: 8rpx;
}

.step-chip.active {
  background: linear-gradient(135deg, rgba(35, 116, 82, 0.9), rgba(11, 49, 40, 0.9));
  border-color: rgba(141, 240, 199, 0.7);
  box-shadow: inset 0 0 0 2rpx rgba(141, 240, 199, 0.12);
}

.step-label {
  color: #e9fff5;
  font-size: 26rpx;
  font-weight: 900;
  line-height: 1.2;
}

.step-points {
  margin-top: 6rpx;
  color: #9ab4a8;
  font-size: 22rpx;
  font-weight: 800;
}

.step-chip.active .step-points {
  color: #ffcc4d;
}
</style>
