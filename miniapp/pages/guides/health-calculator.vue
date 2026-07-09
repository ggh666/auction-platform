<template>
  <view class="page">
    <view class="result-panel">
      <view>
        <text class="kicker">血量配置</text>
        <text class="title">血量计算</text>
      </view>
      <view class="result-main">
        <text class="result-number">{{ result.formattedTotalHealth }}</text>
        <text class="result-label">战车血量</text>
      </view>
    </view>

    <view class="config-panel">
      <view class="panel-heading">
        <text>基础血量</text>
        <text>{{ result.totalBaseHealth }}</text>
      </view>
      <view class="form-grid">
        <view class="form-row">
          <text>主卡血量</text>
          <input type="number" :value="`${config.mainCardHealth}`" @input="updateNumber('mainCardHealth', $event)" />
        </view>
        <view class="form-row">
          <text>副卡血量</text>
          <input type="number" :value="`${config.subCardHealth}`" @input="updateNumber('subCardHealth', $event)" />
        </view>
      </view>
    </view>

    <view class="config-panel">
      <view class="panel-heading">
        <text>加成配置</text>
        <text>+{{ result.totalBonusPercent }}%</text>
      </view>

      <view class="option-group">
        <text class="option-label">装备</text>
        <view class="segmented">
          <view
            v-for="item in equipmentOptions"
            :key="item"
            class="segment"
            :class="{ active: config.equipment === item }"
            @tap="selectOption('equipment', item)"
          >
            {{ item }}
          </view>
        </view>
      </view>

      <view class="option-group">
        <text class="option-label">幻皮</text>
        <view class="segmented two">
          <view
            v-for="item in phantomSkinOptions"
            :key="item"
            class="segment"
            :class="{ active: config.phantomSkin === item }"
            @tap="selectOption('phantomSkin', item)"
          >
            {{ item }}
          </view>
        </view>
      </view>

      <view class="option-group">
        <text class="option-label">满星死神</text>
        <view class="segmented compact">
          <view
            v-for="item in fullStarDeathOptions"
            :key="item"
            class="segment"
            :class="{ active: config.fullStarDeathLevel === item }"
            @tap="selectOption('fullStarDeathLevel', item)"
          >
            {{ item }}
          </view>
        </view>
      </view>

      <view class="option-group">
        <text class="option-label">绿星死神</text>
        <view class="segmented compact">
          <view
            v-for="item in greenStarDeathOptions"
            :key="item"
            class="segment"
            :class="{ active: config.greenStarDeathLevel === item }"
            @tap="selectOption('greenStarDeathLevel', item)"
          >
            {{ item }}
          </view>
        </view>
      </view>

      <view class="option-group">
        <text class="option-label">死神皮肤</text>
        <view class="segmented">
          <view
            v-for="item in deathSkinOptions"
            :key="item"
            class="segment"
            :class="{ active: config.deathSkin === item }"
            @tap="selectOption('deathSkin', item)"
          >
            {{ item }}
          </view>
        </view>
      </view>
    </view>

    <view class="config-panel">
      <view class="panel-heading">
        <text>英雄与额外</text>
        <text>实时计算</text>
      </view>
      <view class="switch-grid">
        <label class="check-row">
          <checkbox :checked="config.deathDemonized" color="#36b86f" @tap="toggleBoolean('deathDemonized')" />
          <text>魔化死神</text>
        </label>
        <label class="check-row">
          <checkbox :checked="config.chiefDemonized" color="#36b86f" @tap="toggleBoolean('chiefDemonized')" />
          <text>魔化酋长</text>
        </label>
        <label class="check-row">
          <checkbox :checked="config.earthSpiritDemonized" color="#36b86f" @tap="toggleBoolean('earthSpiritDemonized')" />
          <text>魔化土灵</text>
        </label>
        <label class="check-row">
          <checkbox :checked="config.guguBloodSkin" color="#36b86f" @tap="toggleBoolean('guguBloodSkin')" />
          <text>咕咕皮</text>
        </label>
      </view>
      <view class="form-grid">
        <view class="form-row">
          <text>牧师个数</text>
          <input type="number" :value="`${config.priestCount}`" @input="updateNumber('priestCount', $event)" />
        </view>
        <view class="form-row">
          <text>宋江羁绊数</text>
          <input type="number" :value="`${config.songJiangBondCount}`" @input="updateNumber('songJiangBondCount', $event)" />
        </view>
        <view class="form-row">
          <text>占星血量(%)</text>
          <input type="digit" :value="`${config.astrologyHealthPercent}`" @input="updateNumber('astrologyHealthPercent', $event)" />
        </view>
        <view class="form-row">
          <text>血车(%)</text>
          <input type="digit" :value="`${config.bloodChariotHealthPercent}`" @input="updateNumber('bloodChariotHealthPercent', $event)" />
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { onShareAppMessage, onShareTimeline, onShow } from "@dcloudio/uni-app";
import { computed, reactive } from "vue";
import {
  calculateHealth,
  defaultHealthCalculatorConfig,
  healthCalculatorDeathSkinOptions,
  healthCalculatorEquipmentOptions,
  healthCalculatorFullStarDeathOptions,
  healthCalculatorGreenStarDeathOptions,
  healthCalculatorPhantomSkinOptions,
  type HealthCalculatorConfig
} from "@auction/shared";
import { buildHealthCalculatorShare, toTimelineShare } from "../../utils/share";

const config = reactive<HealthCalculatorConfig>({ ...defaultHealthCalculatorConfig });
const equipmentOptions = healthCalculatorEquipmentOptions;
const phantomSkinOptions = healthCalculatorPhantomSkinOptions;
const fullStarDeathOptions = healthCalculatorFullStarDeathOptions;
const greenStarDeathOptions = healthCalculatorGreenStarDeathOptions;
const deathSkinOptions = healthCalculatorDeathSkinOptions;

const result = computed(() => calculateHealth({ ...config }));

onShow(() => {
  uni.showShareMenu({ withShareTicket: true, menus: ["shareAppMessage", "shareTimeline"] });
});

onShareAppMessage(() => buildHealthCalculatorShare());

onShareTimeline(() => toTimelineShare(buildHealthCalculatorShare()));

function selectOption<K extends keyof HealthCalculatorConfig>(key: K, value: HealthCalculatorConfig[K]) {
  config[key] = value;
}

function toggleBoolean(key: "deathDemonized" | "chiefDemonized" | "earthSpiritDemonized" | "guguBloodSkin") {
  config[key] = !config[key];
}

function updateNumber(key: keyof HealthCalculatorConfig, event: Event) {
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
.option-label {
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

.result-label {
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

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16rpx;
  margin-top: 18rpx;
}

.form-row {
  min-width: 0;
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

.check-row checkbox {
  transform: scale(0.82);
}
</style>
