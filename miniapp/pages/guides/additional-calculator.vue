<template>
  <view class="page">
    <view class="result-panel">
      <view>
        <text class="kicker">附加配置</text>
        <text class="title">附加伤害计算</text>
      </view>
      <view class="result-main">
        <text class="result-number">{{ result.formattedAdditionalDamage }}</text>
        <text class="result-label">附加伤害</text>
      </view>
    </view>

    <view class="config-panel">
      <view class="panel-heading">
        <text>基础附加</text>
        <text>{{ result.baseAdditionalDamage }}</text>
      </view>
      <view class="form-row">
        <text>固定附加</text>
        <input type="number" :value="`${config.fixedAdditionalDamage}`" @input="updateNumber('fixedAdditionalDamage', $event)" />
      </view>
    </view>

    <view class="config-panel">
      <view class="panel-heading">
        <text>水灵配置</text>
        <text>+{{ result.totalBonusPercent }}%</text>
      </view>

      <view class="option-group">
        <text class="option-label">水灵等级</text>
        <view class="segmented compact">
          <view
            v-for="item in sirenLevelOptions"
            :key="item"
            class="segment"
            :class="{ active: config.sirenLevel === item }"
            @tap="selectOption('sirenLevel', item)"
          >
            {{ item }}
          </view>
        </view>
      </view>

      <view class="option-group">
        <text class="option-label">水灵皮肤</text>
        <view class="segmented two">
          <view
            v-for="item in sirenSkinOptions"
            :key="item"
            class="segment"
            :class="{ active: config.sirenSkin === item }"
            @tap="selectOption('sirenSkin', item)"
          >
            {{ item }}
          </view>
        </view>
      </view>

      <view class="switch-grid">
        <label class="check-row">
          <checkbox :checked="config.sirenDemonized" color="#36b86f" @tap="toggleBoolean('sirenDemonized')" />
          <text>魔化水灵</text>
        </label>
        <label class="check-row">
          <checkbox :checked="config.guguDemonized" color="#36b86f" @tap="toggleBoolean('guguDemonized')" />
          <text>魔化咕咕</text>
        </label>
      </view>
    </view>

    <view class="config-panel">
      <view class="panel-heading">
        <text>英雄与皮肤</text>
        <text>实时计算</text>
      </view>

      <view class="form-row">
        <text>魔化数量</text>
        <input
          type="number"
          :disabled="!config.guguDemonized"
          :value="`${config.demonizedHeroCount}`"
          @input="updateNumber('demonizedHeroCount', $event)"
        />
        <text class="hint">魔化咕咕开启时，每上阵 1 个魔化英雄 +10%</text>
      </view>

      <view class="option-group">
        <text class="option-label">骨弓皮肤</text>
        <view class="segmented two">
          <view
            v-for="item in boneBowSkinOptions"
            :key="item"
            class="segment"
            :class="{ active: config.boneBowSkin === item }"
            @tap="selectOption('boneBowSkin', item)"
          >
            {{ item }}
          </view>
        </view>
      </view>

      <label class="check-row single">
        <checkbox :checked="config.witchDoctorDemonized" color="#36b86f" @tap="toggleBoolean('witchDoctorDemonized')" />
        <text>魔化巫医</text>
      </label>
    </view>
  </view>
</template>

<script setup lang="ts">
import { onShareAppMessage, onShareTimeline, onShow } from "@dcloudio/uni-app";
import { computed, reactive } from "vue";
import {
  additionalCalculatorBoneBowSkinOptions,
  additionalCalculatorSirenLevelOptions,
  additionalCalculatorSirenSkinOptions,
  calculateAdditionalDamage,
  defaultAdditionalDamageCalculatorConfig,
  type AdditionalDamageCalculatorConfig
} from "@auction/shared";
import { buildAdditionalCalculatorShare, toTimelineShare } from "../../utils/share";

const config = reactive<AdditionalDamageCalculatorConfig>({ ...defaultAdditionalDamageCalculatorConfig });
const sirenLevelOptions = additionalCalculatorSirenLevelOptions;
const sirenSkinOptions = additionalCalculatorSirenSkinOptions;
const boneBowSkinOptions = additionalCalculatorBoneBowSkinOptions;

const result = computed(() => calculateAdditionalDamage({ ...config }));

onShow(() => {
  uni.showShareMenu({ withShareTicket: true, menus: ["shareAppMessage", "shareTimeline"] });
});

onShareAppMessage(() => buildAdditionalCalculatorShare());

onShareTimeline(() => toTimelineShare(buildAdditionalCalculatorShare()));

function selectOption<K extends keyof AdditionalDamageCalculatorConfig>(key: K, value: AdditionalDamageCalculatorConfig[K]) {
  config[key] = value;
}

function toggleBoolean(key: "sirenDemonized" | "guguDemonized" | "witchDoctorDemonized") {
  config[key] = !config[key];
}

function updateNumber(key: keyof AdditionalDamageCalculatorConfig, event: Event) {
  const value = String((event.target as HTMLInputElement | null)?.value ?? "");
  config[key] = value as never;
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
.config-panel {
  margin-bottom: 18rpx;
  padding: 24rpx;
  background: linear-gradient(135deg, rgba(14, 45, 40, 0.94), rgba(8, 22, 22, 0.96));
  border: 1px solid rgba(246, 196, 83, 0.34);
  border-radius: 8rpx;
  box-shadow: 0 18rpx 40rpx rgba(0, 0, 0, 0.28), inset 0 1rpx 0 rgba(255, 255, 255, 0.1);
}

.result-panel {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20rpx;
}

.kicker,
.title,
.result-number,
.result-label,
.panel-heading,
.option-label,
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
  font-size: 40rpx;
  font-weight: 900;
}

.result-main {
  flex: 0 0 auto;
  min-width: 220rpx;
  text-align: right;
}

.result-number {
  color: #ff4b4b;
  font-size: 42rpx;
  font-weight: 900;
}

.result-label,
.hint {
  margin-top: 6rpx;
  color: #9ab4a8;
  font-size: 24rpx;
  font-weight: 700;
}

.panel-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 18rpx;
  color: #f7e8b6;
  font-size: 30rpx;
  font-weight: 900;
  border-bottom: 1px solid rgba(246, 196, 83, 0.18);
}

.panel-heading text:last-child {
  color: #8df0c7;
  font-size: 24rpx;
}

.form-row {
  min-width: 0;
  margin-top: 18rpx;
}

.form-row text,
.option-label {
  color: #9ee8c7;
  font-size: 24rpx;
  font-weight: 800;
}

.form-row input {
  height: 72rpx;
  margin-top: 10rpx;
  padding: 0 16rpx;
  color: #f7e8b6;
  font-size: 28rpx;
  font-weight: 800;
  background: rgba(4, 15, 15, 0.7);
  border: 1px solid rgba(246, 196, 83, 0.26);
  border-radius: 8rpx;
}

.form-row input[disabled] {
  opacity: 0.5;
}

.option-group {
  margin-top: 20rpx;
}

.segmented {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10rpx;
  margin-top: 12rpx;
}

.segmented.two {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.segmented.compact {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.segment {
  display: flex;
  min-height: 64rpx;
  align-items: center;
  justify-content: center;
  padding: 0 10rpx;
  color: #9ab4a8;
  font-size: 24rpx;
  font-weight: 800;
  text-align: center;
  background: rgba(4, 15, 15, 0.58);
  border: 1px solid rgba(154, 180, 168, 0.22);
  border-radius: 8rpx;
}

.segment.active {
  color: #1d1605;
  background: linear-gradient(180deg, #ffe08a, #d99620);
  border-color: rgba(255, 224, 138, 0.8);
  box-shadow: 0 8rpx 20rpx rgba(246, 196, 83, 0.2);
}

.switch-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12rpx;
  margin-top: 18rpx;
}

.check-row {
  display: flex;
  min-width: 0;
  min-height: 60rpx;
  align-items: center;
  gap: 8rpx;
  color: #f7e8b6;
  font-size: 24rpx;
  font-weight: 800;
}

.check-row.single {
  margin-top: 18rpx;
}

.check-row checkbox {
  transform: scale(0.82);
}
</style>
