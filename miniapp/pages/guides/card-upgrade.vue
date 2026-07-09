<template>
  <view class="page">
    <view class="result-panel">
      <view>
        <text class="kicker">基础功能</text>
        <text class="title">卡牌升级</text>
        <text class="subtitle">{{ result.cardTypeName }} {{ result.currentLevel }} 级升 {{ result.targetLevel }} 级</text>
      </view>
      <view class="result-main">
        <text class="result-number">{{ result.requiredCardCount }}</text>
        <text class="result-label">还需卡牌</text>
      </view>
    </view>

    <view class="summary-grid">
      <view class="summary-card">
        <text class="summary-value">{{ result.formattedRequiredCards }}</text>
        <text class="summary-label">所需卡牌</text>
      </view>
      <view class="summary-card">
        <text class="summary-value">{{ result.formattedDevilFruit }}</text>
        <text class="summary-label">恶魔果</text>
      </view>
    </view>

    <view class="config-panel">
      <view class="panel-heading">
        <text>卡牌类型</text>
        <text>{{ result.cardTypeName }}</text>
      </view>
      <view class="type-grid">
        <view
          v-for="option in cardTypeOptions"
          :key="option.type"
          class="type-card"
          :class="[option.type, { active: config.cardType === option.type }]"
          @tap="selectCardType(option.type)"
        >
          <text class="type-name">{{ option.name }}</text>
        </view>
      </view>
    </view>

    <view class="config-panel">
      <view class="panel-heading">
        <text>升级配置</text>
        <text>1-25 级</text>
      </view>
      <view class="form-grid">
        <view class="form-row">
          <text>当前等级</text>
          <input type="number" :value="`${config.currentLevel}`" @input="updateNumber('currentLevel', $event)" />
        </view>
        <view class="form-row">
          <text>目标等级</text>
          <input type="number" :value="`${config.targetLevel}`" @input="updateNumber('targetLevel', $event)" />
        </view>
        <view class="form-row full">
          <text>已有卡牌数</text>
          <input type="number" :value="`${config.currentCount}`" @input="updateNumber('currentCount', $event)" />
        </view>
      </view>
      <text class="hint">已有卡牌数会从总需求中抵扣，结果不会低于 0。</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { onShareAppMessage, onShareTimeline, onShow } from "@dcloudio/uni-app";
import { computed, reactive } from "vue";
import {
  calculateCardUpgrade,
  cardUpgradeTypeOptions,
  defaultCardUpgradeConfig,
  type CardUpgradeConfig,
  type CardUpgradeType
} from "@auction/shared";
import { buildCardUpgradeShare, toTimelineShare } from "../../utils/share";

const config = reactive<CardUpgradeConfig>({ ...defaultCardUpgradeConfig });
const cardTypeOptions = cardUpgradeTypeOptions;
const result = computed(() => calculateCardUpgrade({ ...config }));

onShow(() => {
  uni.showShareMenu({ withShareTicket: true, menus: ["shareAppMessage", "shareTimeline"] });
});

onShareAppMessage(() => buildCardUpgradeShare());

onShareTimeline(() => toTimelineShare(buildCardUpgradeShare()));

function selectCardType(cardType: CardUpgradeType) {
  config.cardType = cardType;
}

function updateNumber(key: "currentLevel" | "targetLevel" | "currentCount", event: Event) {
  const value = String((event.target as HTMLInputElement | null)?.value ?? "");
  config[key] = value;
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
.config-panel,
.summary-card {
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
.summary-value,
.summary-label,
.panel-heading,
.type-name,
.hint {
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
.summary-label,
.hint {
  margin-top: 8rpx;
  color: #9ab4a8;
  font-size: 24rpx;
  font-weight: 700;
}

.result-main {
  flex: 0 0 auto;
  min-width: 180rpx;
  text-align: right;
}

.result-number {
  color: #ffcc4d;
  font-size: 58rpx;
  font-weight: 900;
  line-height: 1;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18rpx;
  margin-bottom: 18rpx;
}

.summary-card {
  padding: 24rpx;
}

.summary-value {
  color: #f7e8b6;
  font-size: 34rpx;
  font-weight: 900;
}

.config-panel {
  padding: 24rpx;
  margin-bottom: 18rpx;
}

.panel-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
  margin-bottom: 20rpx;
  color: #f7e8b6;
  font-size: 30rpx;
  font-weight: 900;
}

.panel-heading text:last-child {
  color: #8df0c7;
  font-size: 24rpx;
}

.type-grid,
.form-grid {
  display: grid;
  gap: 16rpx;
}

.type-grid {
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.type-card {
  min-height: 82rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8rpx;
  border: 1px solid rgba(154, 180, 168, 0.24);
  background: rgba(9, 28, 27, 0.72);
}

.type-card.active {
  border-color: rgba(246, 196, 83, 0.82);
  box-shadow: inset 0 0 0 2rpx rgba(246, 196, 83, 0.24);
}

.type-card.gold.active {
  background: linear-gradient(135deg, rgba(247, 206, 108, 0.34), rgba(9, 28, 27, 0.78));
}

.type-card.purple.active {
  background: linear-gradient(135deg, rgba(167, 109, 255, 0.34), rgba(9, 28, 27, 0.78));
}

.type-card.blue.active {
  background: linear-gradient(135deg, rgba(68, 148, 255, 0.34), rgba(9, 28, 27, 0.78));
}

.type-card.green.active {
  background: linear-gradient(135deg, rgba(54, 184, 111, 0.34), rgba(9, 28, 27, 0.78));
}

.type-name {
  color: #eaf7ef;
  font-size: 26rpx;
  font-weight: 900;
}

.form-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.form-row {
  min-height: 120rpx;
  box-sizing: border-box;
  padding: 18rpx;
  border: 1px solid rgba(141, 240, 199, 0.22);
  border-radius: 8rpx;
  background: rgba(12, 48, 41, 0.7);
}

.form-row.full {
  grid-column: 1 / -1;
}

.form-row text {
  display: block;
  margin-bottom: 12rpx;
  color: #8df0c7;
  font-size: 24rpx;
  font-weight: 800;
}

.form-row input {
  width: 100%;
  height: 54rpx;
  color: #f7e8b6;
  font-size: 30rpx;
  font-weight: 900;
}
</style>
