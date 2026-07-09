<template>
  <view class="page">
    <view class="boss-hero">
      <view class="boss-icon">{{ result.boss.icon }}</view>
      <view class="boss-main">
        <text class="boss-kicker">大漩涡·{{ section }}关</text>
        <text class="boss-title">{{ result.boss.name }}</text>
        <text class="boss-subtitle">{{ result.boss.desc }}</text>
      </view>
      <button class="share-button" open-type="share">分享</button>
    </view>

    <view class="level-grid">
      <view
        v-for="item in maelstromSections"
        :key="item"
        class="level-button"
        :class="{ active: item === section }"
        @tap="selectSection(item)"
      >
        {{ item }}关
      </view>
    </view>

    <view class="info-panel">
      <text class="panel-heading">Boss 属性</text>
      <view class="info-block">
        <text class="info-title">攻击</text>
        <text class="info-text">{{ result.boss.attack }}</text>
      </view>
      <view class="info-block">
        <text class="info-title">防御</text>
        <text class="info-text">{{ result.boss.defense }}</text>
      </view>
      <view class="info-block">
        <text class="info-title">技能 / 被动</text>
        <text class="info-text multi">{{ result.boss.skill }}</text>
      </view>
    </view>

    <view class="result-panel">
      <text class="panel-heading">伤害演算</text>
      <view v-if="result.hasCalculator">
        <view class="result-row primary">
          <text>普通伤害</text>
          <text>{{ result.formattedFinalDamage }}</text>
        </view>
        <view class="tip-row">标题栏显示的是实际生效后的数值</view>
        <view class="result-row">
          <text>战车血量</text>
          <text>{{ result.formattedTotalHealth }}万</text>
        </view>
        <view v-if="result.formattedNormalAttackDamage" class="result-row">
          <text>普通攻击</text>
          <text>{{ result.formattedNormalAttackDamage }}</text>
        </view>
        <view v-if="result.formattedChainAttackDamage" class="result-row">
          <text>锁链攻击</text>
          <text>{{ result.formattedChainAttackDamage }}</text>
        </view>
        <view v-if="result.survivalHits !== null" class="result-row">
          <text>可承受次数</text>
          <text>{{ result.survivalHits }}</text>
        </view>
      </view>
      <view v-else class="empty-result">暂无公式，仅展示Boss机制说明</view>
    </view>

    <view v-if="result.hasCalculator && result.bossCalculationData.showEquipment" class="config-panel">
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

    <view v-if="result.hasCalculator && result.bossCalculationData.showHealth" class="config-panel">
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

    <view v-if="result.bossCalculationData.showHealthPercentReduction" class="config-panel">
      <view class="panel-title" @tap="toggleSection('healthPercent')">
        <text>百分比减免</text>
        <text>{{ percent(result.calculatorData.healthPercentReduction) }}</text>
      </view>
      <view v-if="expanded.healthPercent" class="panel-body">
        <view class="form-row">
          <text>战车百分比减免</text>
          <input type="digit" :value="`${overrides.healthPercentResistanceConfig.healthPercentResistance}`" @input="updateNumber('healthPercentResistanceConfig', 'healthPercentResistance', $event)" />
        </view>
      </view>
    </view>

    <view v-if="result.bossCalculationData.showAttackReduction" class="config-panel">
      <view class="panel-title" @tap="toggleSection('attack')">
        <text>敌方攻击减少%</text>
        <text>{{ percent(result.calculatorData.effectiveAttackReduction) }}</text>
      </view>
      <view v-if="expanded.attack" class="panel-body">
        <label class="check-row">
          <checkbox :checked="overrides.attackReductionConfig.rayEnabled" color="#36b86f" @tap="toggleBoolean('attackReductionConfig', 'rayEnabled')" />
          <text>启用射线减攻</text>
        </label>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import type { MaelstromCalculationResult } from "@auction/shared";
import {
  calculateMaelstromBoss,
  getMaelstromDefaultState,
  maelstromEquipmentOptions,
  maelstromSections
} from "@auction/shared";
import { onLoad, onShareAppMessage, onShareTimeline, onShow } from "@dcloudio/uni-app";
import { computed, reactive, ref } from "vue";
import { buildMaelstromBossShare, toTimelineShare } from "../../utils/share";

type SectionKey = "equipment" | "health" | "damage" | "magic" | "pure" | "trueDamage" | "healthPercent" | "attack";

const section = ref(120);
const equipmentOptions = maelstromEquipmentOptions;
const expanded = reactive<Record<SectionKey, boolean>>({
  equipment: true,
  health: true,
  damage: false,
  magic: false,
  pure: false,
  trueDamage: false,
  healthPercent: false,
  attack: false
});
const overrides = reactive(defaultEditableState(120));
const result = computed<MaelstromCalculationResult>(() =>
  calculateMaelstromBoss({
    section: section.value,
    overrides
  })
);
const equipmentLabel = computed(() => {
  const typeName = overrides.selectedEquipment.typeName || "无";
  return `${overrides.selectedEquipment.isRed ? "红色 " : ""}${typeName}`;
});

onLoad((query) => {
  const nextSection = Number.parseInt(String(query?.section ?? "120"), 10);
  section.value = maelstromSections.includes(nextSection as never) ? nextSection : 120;
  resetOverrides();
  updateTitle();
});

onShow(() => {
  uni.showShareMenu({ withShareTicket: true, menus: ["shareAppMessage", "shareTimeline"] });
});

onShareAppMessage(() => buildMaelstromBossShare({ section: section.value, bossName: result.value.boss.name }));

onShareTimeline(() => toTimelineShare(buildMaelstromBossShare({ section: section.value, bossName: result.value.boss.name })));

function defaultEditableState(nextSection: number) {
  const state = getMaelstromDefaultState(nextSection);
  return {
    selectedEquipment: { ...state.selectedEquipment },
    healthConfig: { ...state.healthConfig },
    magicResistanceConfig: { ...state.magicResistanceConfig },
    pureResistanceConfig: { ...state.pureResistanceConfig },
    trueDamageResistanceConfig: { ...state.trueDamageResistanceConfig },
    damageResistanceConfig: { ...state.damageResistanceConfig },
    additionalDamageResistanceConfig: { ...state.additionalDamageResistanceConfig },
    healthPercentResistanceConfig: { ...state.healthPercentResistanceConfig },
    attackReductionConfig: { ...state.attackReductionConfig }
  };
}

function resetOverrides() {
  const next = defaultEditableState(section.value);
  Object.assign(overrides.selectedEquipment, next.selectedEquipment);
  Object.assign(overrides.healthConfig, next.healthConfig);
  Object.assign(overrides.magicResistanceConfig, next.magicResistanceConfig);
  Object.assign(overrides.pureResistanceConfig, next.pureResistanceConfig);
  Object.assign(overrides.trueDamageResistanceConfig, next.trueDamageResistanceConfig);
  Object.assign(overrides.damageResistanceConfig, next.damageResistanceConfig);
  Object.assign(overrides.additionalDamageResistanceConfig, next.additionalDamageResistanceConfig);
  Object.assign(overrides.healthPercentResistanceConfig, next.healthPercentResistanceConfig);
  Object.assign(overrides.attackReductionConfig, next.attackReductionConfig);
}

function selectSection(nextSection: number) {
  section.value = nextSection;
  resetOverrides();
  updateTitle();
}

function updateTitle() {
  uni.setNavigationBarTitle({ title: `大漩涡·${result.value.boss.name}` });
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
.panel-heading,
.info-title,
.info-text,
.result-row text,
.tip-row,
.panel-title text,
.empty-result {
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
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12rpx;
  margin-bottom: 18rpx;
}

.level-button {
  height: 66rpx;
  color: #d9eadf;
  font-size: 24rpx;
  font-weight: 900;
  line-height: 66rpx;
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

.info-panel,
.result-panel,
.config-panel {
  margin-bottom: 16rpx;
  background: rgba(10, 28, 26, 0.76);
  border: 1px solid rgba(246, 196, 83, 0.24);
  border-radius: 8rpx;
  box-shadow: 0 14rpx 32rpx rgba(0, 0, 0, 0.24), inset 0 1rpx 0 rgba(255, 255, 255, 0.08);
}

.info-panel,
.result-panel {
  padding: 20rpx;
}

.panel-heading {
  margin-bottom: 16rpx;
  color: #f7e8b6;
  font-size: 30rpx;
  font-weight: 900;
}

.info-block {
  padding: 16rpx 0;
  border-top: 1px solid rgba(246, 196, 83, 0.14);
}

.info-title {
  color: #8df0c7;
  font-size: 24rpx;
  font-weight: 900;
}

.info-text {
  margin-top: 8rpx;
  color: #d9eadf;
  font-size: 25rpx;
  font-weight: 700;
  line-height: 1.65;
}

.info-text.multi {
  white-space: pre-line;
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

.tip-row,
.empty-result {
  margin-bottom: 12rpx;
  padding: 14rpx 18rpx;
  color: #8df0c7;
  font-size: 23rpx;
  font-weight: 800;
  background: rgba(20, 184, 166, 0.1);
  border-left: 6rpx solid #8df0c7;
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
