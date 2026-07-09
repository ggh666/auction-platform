<template>
  <view class="page">
    <view class="boss-hero">
      <view class="boss-icon">{{ result.boss.icon }}</view>
      <view class="boss-main">
        <text class="boss-kicker">深海之战·{{ result.level }}关</text>
        <text class="boss-title">{{ result.boss.name }}</text>
        <text class="boss-subtitle">{{ result.boss.attackType }}</text>
      </view>
      <button class="share-button" open-type="share">分享</button>
    </view>

    <view class="level-grid">
      <view
        v-for="level in levelOptions"
        :key="level"
        class="level-button"
        :class="{ active: level === selectedLevel }"
        @tap="selectLevel(level)"
      >
        {{ level }}关
      </view>
    </view>

    <view class="result-panel">
      <view class="result-row primary">
        <text>普通伤害</text>
        <text>{{ result.formattedFinalDamage }}</text>
      </view>
      <view class="tip-row">标题栏显示的是实际生效后的数值</view>
      <view class="result-row">
        <text>战车血量</text>
        <text>{{ result.formattedTotalHealth }}万</text>
      </view>
      <view v-if="result.formattedSingleDamage" class="result-row">
        <text>单段伤害</text>
        <text>{{ result.formattedSingleDamage }}</text>
      </view>
      <view v-if="result.formattedTotalDamage" class="result-row">
        <text>合计伤害</text>
        <text>{{ result.formattedTotalDamage }}</text>
      </view>
      <view v-if="result.formattedChainsawDamage" class="result-row">
        <text>电锯伤害</text>
        <text>{{ result.formattedChainsawDamage }}</text>
      </view>
      <view v-if="result.formattedChainsawDamage4x" class="result-row">
        <text>四段电锯</text>
        <text>{{ result.formattedChainsawDamage4x }}</text>
      </view>
      <view v-if="result.formattedTrueDamage" class="split-result">
        <view>
          <text>真实</text>
          <text>{{ result.formattedTrueDamage }}</text>
        </view>
        <view>
          <text>物理</text>
          <text>{{ result.formattedPhysicalDamage }}</text>
        </view>
        <view>
          <text>魔法</text>
          <text>{{ result.formattedMagicDamage }}</text>
        </view>
      </view>
      <view v-if="result.formattedCritDamage" class="result-row">
        <text>暴击伤害</text>
        <text>{{ result.formattedCritDamage }}</text>
      </view>
    </view>

    <view class="config-panel">
      <view class="panel-title" @tap="toggleSection('equipment')">
        <text>装备</text>
        <text>{{ equipmentLabel }}</text>
      </view>
      <view v-if="expanded.equipment" class="panel-body">
        <label class="check-row">
          <checkbox :checked="overrides.selectedEquipment.isRed" color="#36b86f" @tap="toggleRedEquipment" />
          <text>是否红色</text>
        </label>
        <view class="segmented">
          <view
            v-for="(item, index) in equipmentOptions"
            :key="item"
            class="segment"
            :class="{ active: overrides.selectedEquipment.typeIndex === index }"
            @tap="selectEquipment(index, item)"
          >
            {{ item }}
          </view>
        </view>
      </view>
    </view>

    <view class="config-panel">
      <view class="panel-title" @tap="toggleSection('health')">
        <text>战车血量</text>
        <text>{{ result.formattedTotalHealth }}万</text>
      </view>
      <view v-if="expanded.health" class="panel-body">
        <view class="form-row">
          <text>合体总基础血量</text>
          <input type="number" :value="`${overrides.healthConfig.mainHealth}`" @input="updateNumber('healthConfig', 'mainHealth', $event)" />
        </view>
        <view class="form-row">
          <text>战车+洗练+称号等生命加成(%)</text>
          <input type="digit" :value="`${overrides.healthConfig.healthBonus}`" @input="updateNumber('healthConfig', 'healthBonus', $event)" />
        </view>
        <view class="switch-grid">
          <label class="check-row">
            <checkbox :checked="overrides.healthConfig.deathDemonized" color="#36b86f" @tap="toggleBoolean('healthConfig', 'deathDemonized')" />
            <text>魔化死神</text>
          </label>
          <label class="check-row">
            <checkbox :checked="overrides.healthConfig.chiefDemonized" color="#36b86f" @tap="toggleBoolean('healthConfig', 'chiefDemonized')" />
            <text>魔化酋长</text>
          </label>
          <label class="check-row">
            <checkbox :checked="overrides.healthConfig.guguBloodSkin" color="#36b86f" @tap="toggleBoolean('healthConfig', 'guguBloodSkin')" />
            <text>咕咕血皮</text>
          </label>
        </view>
        <view class="form-row">
          <text>牧师数</text>
          <input type="number" :value="`${overrides.healthConfig.priestCount}`" @input="updateNumber('healthConfig', 'priestCount', $event)" />
        </view>
      </view>
    </view>

    <view v-if="result.bossCalculationData.showDamageReduction" class="config-panel">
      <view class="panel-title" @tap="toggleSection('damage')">
        <text>伤害减免</text>
        <text>{{ percent(result.calculatorData.effectiveDamageReduction) }}</text>
      </view>
      <view v-if="expanded.damage" class="panel-body">
        <view class="form-row">
          <text>战车伤害减免</text>
          <input type="digit" :value="`${overrides.damageResistanceConfig.damageResistanceChariot}`" @input="updateNumber('damageResistanceConfig', 'damageResistanceChariot', $event)" />
        </view>
        <view class="form-row">
          <text>其它伤害减免</text>
          <input type="digit" :value="`${overrides.damageResistanceConfig.damageResistance}`" @input="updateNumber('damageResistanceConfig', 'damageResistance', $event)" />
        </view>
      </view>
    </view>

    <view v-if="result.bossCalculationData.showMagicResistanceReduction" class="config-panel">
      <view class="panel-title" @tap="toggleSection('magic')">
        <text>魔抗减免</text>
        <text>{{ percent(result.calculatorData.effectiveMagicResistance) }}</text>
      </view>
      <view v-if="expanded.magic" class="panel-body">
        <view class="form-row">
          <text>魔抗</text>
          <input type="digit" :value="`${overrides.magicResistanceConfig.magicResistanceChariot}`" @input="updateNumber('magicResistanceConfig', 'magicResistanceChariot', $event)" />
        </view>
        <view class="switch-grid">
          <label class="check-row">
            <checkbox :checked="overrides.magicResistanceConfig.sirenDemonized" color="#36b86f" @tap="toggleBoolean('magicResistanceConfig', 'sirenDemonized')" />
            <text>海妖魔化</text>
          </label>
          <label class="check-row">
            <checkbox :checked="overrides.magicResistanceConfig.sirenSkin" color="#36b86f" @tap="toggleBoolean('magicResistanceConfig', 'sirenSkin')" />
            <text>海妖皮肤</text>
          </label>
          <label class="check-row">
            <checkbox :checked="overrides.magicResistanceConfig.boneBow" color="#36b86f" @tap="toggleBoolean('magicResistanceConfig', 'boneBow')" />
            <text>骨弓</text>
          </label>
        </view>
        <view class="form-row">
          <text>核心数</text>
          <input type="number" :value="`${overrides.magicResistanceConfig.coreCount}`" @input="updateNumber('magicResistanceConfig', 'coreCount', $event)" />
        </view>
      </view>
    </view>

    <view v-if="result.bossCalculationData.showArmorReduction" class="config-panel">
      <view class="panel-title" @tap="toggleSection('armor')">
        <text>护甲减免</text>
        <text>{{ percent(result.calculatorData.effectiveArmorResistance) }}</text>
      </view>
      <view v-if="expanded.armor" class="panel-body">
        <view class="form-row">
          <text>护甲</text>
          <input type="digit" :value="`${overrides.armorResistanceConfig.armorChariot}`" @input="updateNumber('armorResistanceConfig', 'armorChariot', $event)" />
        </view>
        <view class="form-row">
          <text>战士数</text>
          <input type="number" :value="`${overrides.armorResistanceConfig.warriorCount}`" @input="updateNumber('armorResistanceConfig', 'warriorCount', $event)" />
        </view>
      </view>
    </view>

    <view v-if="result.bossCalculationData.showPureReduction" class="config-panel">
      <view class="panel-title" @tap="toggleSection('pure')">
        <text>纯粹减免</text>
        <text>{{ percent(result.calculatorData.effectivePureReduction) }}</text>
      </view>
      <view v-if="expanded.pure" class="panel-body">
        <view class="form-row">
          <text>纯粹减免</text>
          <input type="digit" :value="`${overrides.pureResistanceConfig.pureResistanceChariot}`" @input="updateNumber('pureResistanceConfig', 'pureResistanceChariot', $event)" />
        </view>
        <view class="switch-grid">
          <label class="check-row">
            <checkbox :checked="overrides.pureResistanceConfig.iceKnightDemonized" color="#36b86f" @tap="toggleBoolean('pureResistanceConfig', 'iceKnightDemonized')" />
            <text>冰骑魔化</text>
          </label>
          <label class="check-row">
            <checkbox :checked="overrides.pureResistanceConfig.iceKnightSkin" color="#36b86f" @tap="toggleBoolean('pureResistanceConfig', 'iceKnightSkin')" />
            <text>冰骑皮肤</text>
          </label>
        </view>
      </view>
    </view>

    <view v-if="result.bossCalculationData.showElementReduction" class="config-panel">
      <view class="panel-title" @tap="toggleSection('element')">
        <text>元素减免</text>
        <text>{{ percent(result.calculatorData.effectiveElementResistance) }}</text>
      </view>
      <view v-if="expanded.element" class="panel-body">
        <view class="form-row">
          <text>熊猫数</text>
          <input type="number" :value="`${overrides.elementResistanceConfig.pandaCount}`" @input="updateNumber('elementResistanceConfig', 'pandaCount', $event)" />
        </view>
        <label class="check-row">
          <checkbox :checked="overrides.elementResistanceConfig.earthSpiritSkin" color="#36b86f" @tap="toggleBoolean('elementResistanceConfig', 'earthSpiritSkin')" />
          <text>土灵皮肤</text>
        </label>
      </view>
    </view>

    <view v-if="result.bossCalculationData.showTrueDamageReduction" class="config-panel">
      <view class="panel-title" @tap="toggleSection('trueDamage')">
        <text>真伤减免</text>
        <text>{{ percent(result.calculatorData.effectiveTrueDamageResistance) }}</text>
      </view>
      <view v-if="expanded.trueDamage" class="panel-body">
        <view class="form-row">
          <text>战车真伤减免</text>
          <input type="digit" :value="`${overrides.trueDamageResistanceConfig.trueDamageResistanceChariot}`" @input="updateNumber('trueDamageResistanceConfig', 'trueDamageResistanceChariot', $event)" />
        </view>
        <view class="switch-grid">
          <label class="check-row">
            <checkbox :checked="overrides.trueDamageResistanceConfig.rayDemonized" color="#36b86f" @tap="toggleBoolean('trueDamageResistanceConfig', 'rayDemonized')" />
            <text>射线魔化</text>
          </label>
          <label class="check-row">
            <checkbox :checked="overrides.trueDamageResistanceConfig.raySkin" color="#36b86f" @tap="toggleBoolean('trueDamageResistanceConfig', 'raySkin')" />
            <text>射线皮肤</text>
          </label>
        </view>
      </view>
    </view>

    <view v-if="result.bossCalculationData.showAttackReduction" class="config-panel">
      <view class="panel-title" @tap="toggleSection('attack')">
        <text>敌方攻击减少%</text>
        <text>{{ percent(result.calculatorData.effectiveAttackReduction) }}</text>
      </view>
      <view v-if="expanded.attack" class="panel-body">
        <view v-if="result.bossCalculationData.showSquadMemberCount" class="form-row">
          <text>上阵人数</text>
          <input type="number" :value="`${overrides.squadMemberCount}`" @input="updateSquadMemberCount" />
        </view>
        <label class="check-row">
          <checkbox :checked="overrides.attackReductionConfig.rayEnabled" color="#36b86f" @tap="toggleBoolean('attackReductionConfig', 'rayEnabled')" />
          <text>启用射线减攻</text>
        </label>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import type { DeepSeaCalculationResult } from "@auction/shared";
import {
  calculateDeepSeaBoss,
  deepSeaEquipmentOptions,
  deepSeaLevelOptions,
  getDeepSeaDefaultLevel,
  getDeepSeaDefaultState
} from "@auction/shared";
import { onLoad, onShareAppMessage, onShareTimeline, onShow } from "@dcloudio/uni-app";
import { computed, reactive, ref } from "vue";
import { buildDeepSeaBossShare, toTimelineShare } from "../../utils/share";

type SectionKey =
  | "equipment"
  | "health"
  | "damage"
  | "magic"
  | "armor"
  | "pure"
  | "element"
  | "trueDamage"
  | "attack";

const section = ref(1);
const selectedLevel = ref(50);
const equipmentOptions = deepSeaEquipmentOptions;
const expanded = reactive<Record<SectionKey, boolean>>({
  equipment: true,
  health: true,
  damage: false,
  magic: false,
  armor: false,
  pure: false,
  element: false,
  trueDamage: false,
  attack: false
});
const overrides = reactive(defaultEditableState(1, 50));

const levelOptions = computed(() => deepSeaLevelOptions[section.value] ?? []);
const result = computed<DeepSeaCalculationResult>(() =>
  calculateDeepSeaBoss({
    section: section.value,
    level: selectedLevel.value,
    overrides
  })
);
const equipmentLabel = computed(() => {
  const typeName = overrides.selectedEquipment.typeName || "无";
  return `${overrides.selectedEquipment.isRed ? "红色 " : ""}${typeName}`;
});

onLoad((query) => {
  const nextSection = Number.parseInt(String(query?.section ?? "1"), 10);
  section.value = Number.isFinite(nextSection) ? nextSection : 1;
  const defaultLevel = getDeepSeaDefaultLevel(section.value);
  const nextLevel = Number.parseInt(String(query?.level ?? `${defaultLevel}`), 10);
  selectedLevel.value = Number.isFinite(nextLevel) ? nextLevel : defaultLevel;
  resetOverrides();
});

onShow(() => {
  uni.showShareMenu({ withShareTicket: true, menus: ["shareAppMessage", "shareTimeline"] });
});

onShareAppMessage(() =>
  buildDeepSeaBossShare({ section: section.value, level: selectedLevel.value, bossName: result.value.boss.name })
);

onShareTimeline(() => toTimelineShare(buildDeepSeaBossShare({ section: section.value, level: selectedLevel.value })));

function defaultEditableState(nextSection: number, nextLevel: number) {
  const state = getDeepSeaDefaultState(nextSection, nextLevel);
  const defaultDamageBonus = calculateDeepSeaBoss({ section: nextSection, level: nextLevel }).bossCalculationData.damageBonus;
  return {
    selectedEquipment: { ...state.selectedEquipment },
    healthConfig: { ...state.healthConfig },
    magicResistanceConfig: { ...state.magicResistanceConfig },
    armorResistanceConfig: { ...state.armorResistanceConfig },
    pureResistanceConfig: { ...state.pureResistanceConfig },
    trueDamageResistanceConfig: { ...state.trueDamageResistanceConfig },
    elementResistanceConfig: { ...state.elementResistanceConfig },
    damageResistanceConfig: {
      ...state.damageResistanceConfig,
      damageResistanceChariot: 90 + defaultDamageBonus
    },
    additionalDamageResistanceConfig: { ...state.additionalDamageResistanceConfig },
    healthPercentResistanceConfig: { ...state.healthPercentResistanceConfig },
    attackReductionConfig: { ...state.attackReductionConfig },
    squadMemberCount: state.squadMemberCount
  };
}

function resetOverrides() {
  const next = defaultEditableState(section.value, selectedLevel.value);
  Object.assign(overrides.selectedEquipment, next.selectedEquipment);
  Object.assign(overrides.healthConfig, next.healthConfig);
  Object.assign(overrides.magicResistanceConfig, next.magicResistanceConfig);
  Object.assign(overrides.armorResistanceConfig, next.armorResistanceConfig);
  Object.assign(overrides.pureResistanceConfig, next.pureResistanceConfig);
  Object.assign(overrides.trueDamageResistanceConfig, next.trueDamageResistanceConfig);
  Object.assign(overrides.elementResistanceConfig, next.elementResistanceConfig);
  Object.assign(overrides.damageResistanceConfig, next.damageResistanceConfig);
  Object.assign(overrides.additionalDamageResistanceConfig, next.additionalDamageResistanceConfig);
  Object.assign(overrides.healthPercentResistanceConfig, next.healthPercentResistanceConfig);
  Object.assign(overrides.attackReductionConfig, next.attackReductionConfig);
  overrides.squadMemberCount = next.squadMemberCount;
}

function selectLevel(level: number) {
  selectedLevel.value = level;
  resetOverrides();
}

function selectEquipment(index: number, item: string) {
  overrides.selectedEquipment.typeIndex = index;
  overrides.selectedEquipment.typeName = item;
}

function toggleRedEquipment() {
  overrides.selectedEquipment.isRed = !overrides.selectedEquipment.isRed;
}

function toggleSection(key: SectionKey) {
  expanded[key] = !expanded[key];
}

function updateNumber(group: keyof ReturnType<typeof defaultEditableState>, field: string, event: unknown) {
  const rawValue = readInputValue(event);
  const value = rawValue === "" ? "" : Number(rawValue);
  const target = overrides[group] as Record<string, unknown>;
  target[field] = value;
}

function updateSquadMemberCount(event: unknown) {
  overrides.squadMemberCount = Number(readInputValue(event) || 0);
}

function toggleBoolean(group: keyof ReturnType<typeof defaultEditableState>, field: string) {
  const target = overrides[group] as Record<string, unknown>;
  target[field] = !target[field];
}

function percent(value: number) {
  return `${value.toFixed(2)}%`;
}

function readInputValue(event: unknown): string {
  const inputEvent = event as { detail?: { value?: unknown }; target?: { value?: unknown } };
  const value = inputEvent.detail?.value ?? inputEvent.target?.value ?? "";
  return String(value);
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

.boss-hero {
  display: flex;
  align-items: center;
  gap: 18rpx;
  margin-bottom: 18rpx;
  padding: 22rpx;
  background: linear-gradient(135deg, rgba(18, 52, 46, 0.96), rgba(9, 22, 22, 0.96));
  border: 1px solid rgba(246, 196, 83, 0.34);
  border-radius: 8rpx;
  box-shadow: 0 18rpx 40rpx rgba(0, 0, 0, 0.32), inset 0 1rpx 0 rgba(255, 255, 255, 0.12);
}

.boss-icon {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  width: 76rpx;
  height: 76rpx;
  color: #1d1605;
  font-size: 30rpx;
  font-weight: 900;
  background: linear-gradient(180deg, #ffe08a, #d99620);
  border-radius: 50%;
}

.boss-main {
  flex: 1;
  min-width: 0;
}

.boss-kicker,
.boss-title,
.boss-subtitle,
.result-row text,
.tip-row,
.panel-title text {
  display: block;
}

.boss-kicker {
  color: #8df0c7;
  font-size: 23rpx;
  font-weight: 800;
}

.boss-title {
  margin-top: 4rpx;
  color: #f7e8b6;
  font-size: 38rpx;
  font-weight: 900;
}

.boss-subtitle {
  margin-top: 4rpx;
  color: #9ab4a8;
  font-size: 24rpx;
  font-weight: 700;
}

.share-button {
  flex: 0 0 auto;
  height: 58rpx;
  margin: 0;
  padding: 0 18rpx;
  color: #f7e8b6;
  font-size: 24rpx;
  font-weight: 800;
  line-height: 58rpx;
  background: rgba(12, 35, 31, 0.88);
  border: 1px solid rgba(246, 196, 83, 0.34);
  border-radius: 8rpx;
}

.share-button::after {
  border: 0;
}

.level-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12rpx;
  margin-bottom: 18rpx;
}

.level-button {
  height: 72rpx;
  color: #d9eadf;
  font-size: 26rpx;
  font-weight: 900;
  line-height: 72rpx;
  text-align: center;
  background: rgba(10, 28, 26, 0.8);
  border: 1px solid rgba(246, 196, 83, 0.24);
  border-radius: 8rpx;
}

.level-button.active {
  color: #1d1605;
  background: linear-gradient(180deg, #ffe08a, #d99620);
  border-color: rgba(246, 196, 83, 0.82);
}

.result-panel,
.config-panel {
  margin-bottom: 16rpx;
  background: rgba(10, 28, 26, 0.76);
  border: 1px solid rgba(246, 196, 83, 0.24);
  border-radius: 8rpx;
  box-shadow: 0 14rpx 32rpx rgba(0, 0, 0, 0.24), inset 0 1rpx 0 rgba(255, 255, 255, 0.08);
}

.result-panel {
  padding: 20rpx;
}

.result-row,
.panel-title,
.form-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
}

.result-row {
  min-height: 58rpx;
  color: #d9eadf;
  font-size: 26rpx;
  font-weight: 800;
}

.result-row.primary {
  min-height: 74rpx;
  margin-bottom: 12rpx;
  padding: 0 18rpx;
  color: #f7e8b6;
  font-size: 30rpx;
  background: linear-gradient(135deg, rgba(246, 196, 83, 0.18), rgba(20, 184, 166, 0.1));
  border-radius: 8rpx;
}

.tip-row {
  margin-bottom: 12rpx;
  padding: 14rpx 18rpx;
  color: #8df0c7;
  font-size: 23rpx;
  font-weight: 800;
  background: rgba(20, 184, 166, 0.1);
  border-left: 6rpx solid #8df0c7;
  border-radius: 8rpx;
}

.split-result {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10rpx;
  margin-top: 10rpx;
}

.split-result view {
  padding: 14rpx 8rpx;
  color: #d9eadf;
  font-size: 22rpx;
  font-weight: 800;
  text-align: center;
  background: rgba(18, 52, 46, 0.72);
  border-radius: 8rpx;
}

.config-panel {
  overflow: hidden;
}

.panel-title {
  min-height: 74rpx;
  padding: 0 20rpx;
  color: #f7e8b6;
  font-size: 27rpx;
  font-weight: 900;
  background: rgba(18, 52, 46, 0.82);
}

.panel-title text:last-child {
  color: #8df0c7;
  font-size: 24rpx;
}

.panel-body {
  padding: 20rpx;
  border-top: 1px solid rgba(246, 196, 83, 0.16);
}

.form-row {
  min-height: 72rpx;
  color: #d9eadf;
  font-size: 24rpx;
  font-weight: 800;
}

.form-row input {
  width: 200rpx;
  height: 56rpx;
  padding: 0 16rpx;
  color: #f7e8b6;
  font-size: 24rpx;
  font-weight: 800;
  text-align: right;
  background: rgba(7, 17, 18, 0.86);
  border: 1px solid rgba(246, 196, 83, 0.24);
  border-radius: 8rpx;
}

.segmented {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10rpx;
  margin-top: 14rpx;
}

.segment {
  height: 58rpx;
  color: #d9eadf;
  font-size: 24rpx;
  font-weight: 900;
  line-height: 58rpx;
  text-align: center;
  background: rgba(7, 17, 18, 0.72);
  border: 1px solid rgba(246, 196, 83, 0.2);
  border-radius: 8rpx;
}

.segment.active {
  color: #1d1605;
  background: linear-gradient(180deg, #ffe08a, #d99620);
}

.switch-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10rpx 14rpx;
  margin: 12rpx 0;
}

.check-row {
  display: flex;
  align-items: center;
  gap: 8rpx;
  min-height: 54rpx;
  color: #d9eadf;
  font-size: 23rpx;
  font-weight: 800;
}
</style>
