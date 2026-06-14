<template>
  <view class="page">
    <view v-if="publishEnabled || loginRequired" class="header">
      <text class="title">发布交换</text>
      <text class="summary">当前仅支持龙珠资源信息发布。</text>
    </view>

    <view v-if="loginRequired" class="switch-note">
      <text>请先登录后再发布交换</text>
      <button v-if="loginRequired" class="inline-login-button" @tap="goLogin">去登录</button>
    </view>

    <template v-if="publishEnabled">
      <view class="retention-note">
        <text>交换信息仅保留30天，后台数据到期后会过期，请及时重新发布。</text>
      </view>

      <view class="form-panel">
        <view class="field">
          <text class="field-label">游戏</text>
          <view v-if="singleGameOption" class="picker-value selected-game-value">
            <text>{{ form.gameName }}</text>
            <text class="selected-game-tag">已默认选中</text>
          </view>
          <picker v-else mode="selector" :range="gameOptions" :value="selectedGameIndex" @change="onGameChange">
            <view class="picker-value">{{ form.gameName }}</view>
          </picker>
        </view>
        <label class="field">
          <text class="field-label">标题</text>
          <input v-model="form.title" class="input" maxlength="80" placeholder="一句话说明龙珠亮点" />
        </label>

        <view class="dragon-grid">
          <view class="field compact-field">
            <text class="field-label">职业</text>
            <picker
              mode="selector"
              :range="dragonBallProfessionOptions"
              :value="selectedProfessionIndex"
              @change="onProfessionChange"
            >
              <view class="picker-value">{{ form.dragonBallProfession }}</view>
            </picker>
          </view>
          <view class="field compact-field">
            <text class="field-label">品质</text>
            <picker mode="selector" :range="qualityLabels" :value="selectedQualityIndex" @change="onQualityChange">
              <view class="picker-value">{{ form.dragonBallQuality }}品质</view>
            </picker>
          </view>
        </view>

        <label class="field">
          <text class="field-label">属性</text>
          <textarea v-model="form.dragonBallAttributes" class="textarea attribute-textarea" maxlength="200" auto-height placeholder="例如：附加伤害+0%，无视冰甲+0%" />
        </label>
        <label class="field">
          <text class="field-label">参考金额（元宝，选填）</text>
          <input
            v-model="form.dragonBallAmountYuan"
            class="input"
            maxlength="12"
            placeholder="选填，仅作信息参考"
            type="number"
          />
          <view class="price-reference-note">
            <view class="price-reference-copy">
              <text class="price-reference-title">{{ referenceRangeText }}</text>
              <text class="price-reference-desc">合理填写参考金额，能更快找到新主人。</text>
            </view>
            <button class="price-reference-button" @tap="openPriceReference">估值参考</button>
          </view>
        </label>
        <view class="field">
          <view class="field-heading">
            <text class="field-label">龙珠图片</text>
            <text class="field-hint">必传，最多 1 张</text>
          </view>
          <view v-if="imagePath" class="image-preview">
            <image class="dragon-image" :src="imagePath" mode="aspectFill" @tap="previewImage" />
            <button class="remove-image-button" @tap="removeImage">删除</button>
          </view>
          <button v-else class="image-picker-button" :loading="uploadingImage" :disabled="uploadingImage" @tap="chooseImage">
            上传龙珠图片
          </button>
        </view>
        <label class="field">
          <text class="field-label">想换什么</text>
          <textarea v-model="form.desiredExchange" class="textarea" maxlength="200" placeholder="填写期望交换的龙珠或资源" />
        </label>
        <label class="field">
          <text class="field-label">补充说明（选填）</text>
          <textarea v-model="form.description" class="textarea" maxlength="500" placeholder="可不填，补充交换条件等" />
        </label>
      </view>

      <checkbox-group class="disclaimer-panel" @change="onDisclaimerChange">
        <label class="disclaimer-row">
          <checkbox color="#f6c453" value="accepted" :checked="disclaimerAccepted" />
          <view class="disclaimer-copy">
            <text class="disclaimer-title">我已阅读并同意免责声明</text>
            <text class="disclaimer-text">
              平台不参与交易、不收款、不担保、不托管、不负责线下交付，私下交易风险由双方自行承担。
            </text>
          </view>
        </label>
      </checkbox-group>

      <button class="submit-button" :loading="submitting" :disabled="submitDisabled" @tap="submit">
        提交发布
      </button>
    </template>
  </view>
</template>

<script setup lang="ts">
import {
  centsToYuanText,
  dragonBallProfessionOptions,
  dragonBallQualityOptions,
  parseYuanToCents,
  type DragonBallPriceReferenceBatch
} from "@auction/shared";
import { onLoad, onShow } from "@dcloudio/uni-app";
import { computed, reactive, ref } from "vue";
import {
  createExchangeResource,
  getDragonBallPriceReferenceLatest,
  getExchangeResourceContext,
  uploadAssetImage,
  type UploadedAssetImage
} from "../../api/client";
import { readSessionUser } from "../../auth/session";
import { loginUrlForRedirect } from "../../utils/authNavigation";
import { gameOptions, normalizeGameName, type GameName } from "../../utils/gameOptions";
import { detectImageMimeType } from "../../utils/imageMime";
import { requestAssetMessageSubscription } from "../../utils/subscribeMessage";

const form = reactive({
  gameName: gameOptions[0] as GameName,
  title: "",
  dragonBallProfession: dragonBallProfessionOptions[0] ?? "",
  dragonBallQuality: dragonBallQualityOptions[3] ?? dragonBallQualityOptions[0] ?? "",
  dragonBallAttributes: "附加伤害+0%，无视冰甲+0%",
  dragonBallAmountYuan: "",
  desiredExchange: "",
  description: ""
});

const publishEnabled = ref(false);
const loginRequired = ref(false);
const imagePath = ref("");
const uploadedImage = ref<UploadedAssetImage | null>(null);
const priceReferenceBatch = ref<DragonBallPriceReferenceBatch | null>(null);
const uploadingImage = ref(false);
const disclaimerAccepted = ref(false);
const submitting = ref(false);
const qualityLabels = dragonBallQualityOptions.map((quality) => `${quality}品质`);

const singleGameOption = computed(() => gameOptions.length === 1);
const selectedGameIndex = computed(() => Math.max(0, gameOptions.findIndex((gameName) => gameName === form.gameName)));
const selectedProfessionIndex = computed(() =>
  Math.max(0, dragonBallProfessionOptions.findIndex((profession) => profession === form.dragonBallProfession))
);
const selectedQualityIndex = computed(() =>
  Math.max(0, dragonBallQualityOptions.findIndex((quality) => quality === form.dragonBallQuality))
);
const submitDisabled = computed(() => submitting.value || uploadingImage.value || !publishEnabled.value);
const currentPriceReference = computed(() => {
  return (
    priceReferenceBatch.value?.items.find(
      (item) => item.profession === form.dragonBallProfession && item.quality === form.dragonBallQuality
    ) ?? null
  );
});
const referenceRangeText = computed(() => {
  const reference = currentPriceReference.value;
  if (!reference) {
    return "暂无该职业品质参考价，可结合成色合理填写。";
  }
  return `${form.dragonBallQuality}品质${form.dragonBallProfession}参考：${centsToYuanText(reference.minPriceCents)} - ${centsToYuanText(reference.maxPriceCents)} 元宝`;
});

onLoad((query) => {
  const queryGameName = normalizeGameName(query?.gameName);
  if (queryGameName) {
    form.gameName = queryGameName;
  }
});

onShow(() => {
  void loadContext();
  void loadPriceReference();
});

async function loadContext() {
  try {
    const response = await getExchangeResourceContext(form.gameName);
    if (!response.enabled) {
      publishEnabled.value = false;
      loginRequired.value = false;
      redirectClosedPublishEntry();
      return;
    }
    loginRequired.value = !readSessionUser();
    publishEnabled.value = !loginRequired.value;
  } catch {
    publishEnabled.value = false;
    loginRequired.value = false;
    redirectClosedPublishEntry();
  }
}

async function loadPriceReference() {
  try {
    const response = await getDragonBallPriceReferenceLatest(form.gameName);
    priceReferenceBatch.value = response.batch;
  } catch {
    priceReferenceBatch.value = null;
  }
}

function readPickerIndex(event: { detail?: { value?: unknown } }): number {
  const value = event.detail?.value;
  const index = typeof value === "number" ? value : Number(value);
  return Number.isInteger(index) && index >= 0 ? index : 0;
}

function onGameChange(event: { detail?: { value?: unknown } }) {
  form.gameName = gameOptions[readPickerIndex(event)] ?? gameOptions[0];
  void loadContext();
  void loadPriceReference();
}

function onProfessionChange(event: { detail?: { value?: unknown } }) {
  form.dragonBallProfession = dragonBallProfessionOptions[readPickerIndex(event)] ?? dragonBallProfessionOptions[0] ?? "";
}

function onQualityChange(event: { detail?: { value?: unknown } }) {
  form.dragonBallQuality = dragonBallQualityOptions[readPickerIndex(event)] ?? dragonBallQualityOptions[0] ?? "";
}

function openPriceReference() {
  uni.navigateTo({
    url: `/pages/priceReference/index?gameName=${encodeURIComponent(form.gameName)}&profession=${encodeURIComponent(form.dragonBallProfession)}&quality=${encodeURIComponent(form.dragonBallQuality)}`
  });
}

function onDisclaimerChange(event: { detail?: { value?: unknown } }) {
  const value = event.detail?.value;
  disclaimerAccepted.value = Array.isArray(value) && value.includes("accepted");
}

function chooseImage() {
  if (uploadingImage.value) {
    return;
  }
  if (!publishEnabled.value) {
    if (loginRequired.value) {
      uni.showToast({ title: "请先登录后再上传图片", icon: "none" });
    }
    return;
  }
  if (imagePath.value) {
    uni.showToast({ title: "最多 1 张龙珠图片", icon: "none" });
    return;
  }
  uni.chooseImage({
    count: 1,
    success(result) {
      const path = normalizeTempFilePaths(result.tempFilePaths)[0];
      if (path) {
        void uploadSelectedImage(path);
      }
    }
  });
}

function normalizeTempFilePaths(value: string | string[] | undefined): string[] {
  if (Array.isArray(value)) {
    return value;
  }
  return typeof value === "string" && value ? [value] : [];
}

async function uploadSelectedImage(path: string) {
  uploadingImage.value = true;
  try {
    const base64Data = await readFileAsBase64(path);
    const mimeType = detectImageMimeType(base64Data);
    if (!mimeType) {
      uni.showToast({ title: "仅支持 JPG、PNG、WEBP 图片", icon: "none" });
      return;
    }
    const response = await uploadAssetImage({
      assetType: "道具",
      usage: "exchange_resource",
      mimeType,
      base64Data
    });
    imagePath.value = path;
    uploadedImage.value = response.image;
  } catch (error) {
    uni.showToast({ title: error instanceof Error && error.message.trim() ? error.message : "图片上传失败", icon: "none" });
  } finally {
    uploadingImage.value = false;
  }
}

function readFileAsBase64(path: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const fileSystemManager = uni.getFileSystemManager();
    fileSystemManager.readFile({
      filePath: path,
      encoding: "base64",
      success(result) {
        if (typeof result.data === "string") {
          resolve(result.data);
          return;
        }
        reject(new Error("图片读取失败"));
      },
      fail(error) {
        reject(error);
      }
    });
  });
}

function previewImage() {
  if (!imagePath.value) {
    return;
  }
  uni.previewImage({ urls: [imagePath.value], current: imagePath.value });
}

function removeImage() {
  imagePath.value = "";
  uploadedImage.value = null;
}

function validateForm(): { ok: true; dragonBallAmountCents: number | null } | { ok: false; message: string } {
  if (!form.gameName.trim() || !form.title.trim()) {
    return { ok: false, message: "请填写游戏和标题" };
  }
  if (!form.dragonBallProfession || !form.dragonBallQuality || !form.dragonBallAttributes.trim()) {
    return { ok: false, message: "请填写龙珠职业、品质和属性" };
  }
  const amountText = form.dragonBallAmountYuan.trim();
  let dragonBallAmountCents: number | null = null;
  if (amountText) {
    try {
      dragonBallAmountCents = parseYuanToCents(amountText);
      if (dragonBallAmountCents <= 0) {
        return { ok: false, message: "参考金额需填写正整数元宝" };
      }
    } catch {
      return { ok: false, message: "参考金额需填写正整数元宝" };
    }
  }
  if (!uploadedImage.value) {
    return { ok: false, message: "请上传龙珠图片" };
  }
  if (!form.desiredExchange.trim()) {
    return { ok: false, message: "请填写想换什么" };
  }
  if (!disclaimerAccepted.value) {
    return { ok: false, message: "请先阅读并同意免责声明" };
  }
  return { ok: true, dragonBallAmountCents };
}

async function submit() {
  if (submitDisabled.value) {
    return;
  }
  const validation = validateForm();
  if (!validation.ok) {
    uni.showToast({ title: validation.message, icon: "none" });
    return;
  }

  submitting.value = true;
  try {
    const image = uploadedImage.value;
    if (!image) {
      uni.showToast({ title: "请上传龙珠图片", icon: "none" });
      return;
    }
    const response = await createExchangeResource({
      gameName: form.gameName.trim(),
      title: form.title.trim(),
      dragonBallAmountCents: validation.dragonBallAmountCents,
      image: {
        objectKey: image.objectKey,
        publicUrl: image.publicUrl,
        mimeType: image.mimeType,
        sizeBytes: image.sizeBytes
      },
      dragonBall: {
        profession: form.dragonBallProfession,
        quality: form.dragonBallQuality,
        attributes: form.dragonBallAttributes.trim()
      },
      desiredExchange: form.desiredExchange.trim(),
      description: form.description.trim()
    });
    await requestAssetMessageSubscription();
    if (response.resource.status === "pending_image_review") {
      uni.showToast({ title: "已提交，图片审核通过后展示", icon: "none" });
      uni.redirectTo({ url: "/pages/profile/exchanges" });
      return;
    }
    uni.showToast({ title: "已发布", icon: "none" });
    uni.redirectTo({ url: `/pages/exchange/detail?resourceId=${response.resource.id}` });
  } catch (error) {
    uni.showToast({ title: error instanceof Error && error.message.trim() ? error.message : "发布失败", icon: "none" });
  } finally {
    submitting.value = false;
  }
}

function goLogin() {
  uni.navigateTo({
    url: loginUrlForRedirect(`/pages/exchange/publish?gameName=${encodeURIComponent(form.gameName)}`)
  });
}

function redirectClosedPublishEntry() {
  uni.redirectTo({
    url: `/pages/exchange/list?gameName=${encodeURIComponent(form.gameName)}`,
    fail() {
      uni.navigateBack({
        delta: 1,
        fail() {
          uni.reLaunch({ url: "/pages/games/index" });
        }
      });
    }
  });
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

.title,
.summary,
.switch-note,
.retention-note,
.field-label,
.field-hint,
.price-reference-title,
.price-reference-desc,
.disclaimer-title,
.disclaimer-text {
  display: block;
}

.header {
  margin-bottom: 20rpx;
}

.title {
  color: #f7e8b6;
  font-size: 36rpx;
  font-weight: 800;
}

.summary {
  margin-top: 8rpx;
  color: #9ab4a8;
}

.switch-note,
.retention-note {
  padding: 18rpx 20rpx;
  margin-bottom: 18rpx;
  color: #f7e8b6;
  background: rgba(246, 196, 83, 0.10);
  border: 1px solid rgba(246, 196, 83, 0.24);
  border-radius: 8rpx;
}

.switch-note {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
}

.inline-login-button {
  flex: 0 0 auto;
  height: 56rpx;
  margin: 0;
  padding: 0 20rpx;
  color: #071112;
  font-size: 24rpx;
  font-weight: 800;
  line-height: 56rpx;
  background: #f6c453;
  border-radius: 6rpx;
}

.price-reference-note {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14rpx;
  margin-top: 12rpx;
  padding: 16rpx;
  background: rgba(246, 196, 83, 0.09);
  border: 1px solid rgba(246, 196, 83, 0.22);
  border-radius: 8rpx;
}

.price-reference-copy {
  flex: 1;
  min-width: 0;
}

.price-reference-title {
  color: #f7e8b6;
  font-size: 24rpx;
  font-weight: 800;
  line-height: 1.45;
}

.price-reference-desc {
  margin-top: 6rpx;
  color: #9ab4a8;
  font-size: 23rpx;
  line-height: 1.45;
}

.price-reference-button {
  flex: 0 0 auto;
  height: 58rpx;
  margin: 0;
  padding: 0 18rpx;
  color: #071112;
  font-size: 24rpx;
  font-weight: 800;
  line-height: 58rpx;
  background: #f6c453;
  border-radius: 6rpx;
}

.form-panel,
.disclaimer-panel {
  padding: 24rpx;
  background: rgba(11, 32, 30, 0.96);
  border: 1px solid rgba(45, 212, 191, 0.24);
  border-radius: 8rpx;
}

.disclaimer-panel {
  margin-top: 18rpx;
  border-color: rgba(246, 196, 83, 0.28);
}

.field {
  display: block;
  margin-bottom: 22rpx;
}

.compact-field {
  margin-bottom: 0;
}

.field-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12rpx;
  margin-bottom: 10rpx;
}

.field-label {
  color: #f6c453;
  font-weight: 800;
}

.field-hint {
  flex: 0 0 auto;
  color: #9ab4a8;
  font-size: 24rpx;
}

.input,
.textarea,
.picker-value {
  box-sizing: border-box;
  width: 100%;
  color: #f7e8b6;
  background: rgba(7, 17, 18, 0.7);
  border: 1px solid rgba(246, 196, 83, 0.22);
  border-radius: 6rpx;
}

.input,
.picker-value {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12rpx;
  height: 76rpx;
  padding: 0 18rpx;
  line-height: 76rpx;
}

.selected-game-value {
  border-color: rgba(246, 196, 83, 0.38);
}

.selected-game-tag {
  flex: 0 0 auto;
  color: #f6c453;
  font-size: 22rpx;
  font-weight: 800;
}

.textarea {
  min-height: 148rpx;
  padding: 18rpx;
  line-height: 1.5;
}

.attribute-textarea {
  min-height: 104rpx;
}

.dragon-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14rpx;
  margin-bottom: 22rpx;
}

.image-preview {
  position: relative;
  width: 220rpx;
  height: 220rpx;
}

.dragon-image {
  width: 220rpx;
  height: 220rpx;
  background: rgba(7, 17, 18, 0.7);
  border: 1px solid rgba(246, 196, 83, 0.24);
  border-radius: 8rpx;
}

.remove-image-button,
.image-picker-button {
  margin: 0;
  color: #f7e8b6;
  font-weight: 800;
  background: rgba(7, 17, 18, 0.74);
  border: 1px solid rgba(246, 196, 83, 0.26);
  border-radius: 8rpx;
}

.remove-image-button {
  position: absolute;
  right: 10rpx;
  bottom: 10rpx;
  height: 52rpx;
  padding: 0 18rpx;
  font-size: 22rpx;
  line-height: 52rpx;
}

.image-picker-button {
  height: 76rpx;
  line-height: 76rpx;
}

.inline-login-button::after,
.price-reference-button::after,
.remove-image-button::after,
.image-picker-button::after,
.submit-button::after {
  border: 0;
}

.disclaimer-row {
  display: flex;
  align-items: flex-start;
  gap: 14rpx;
}

.disclaimer-copy {
  flex: 1;
  min-width: 0;
}

.disclaimer-title {
  color: #f7e8b6;
  font-weight: 800;
}

.disclaimer-text {
  margin-top: 8rpx;
  color: #9ab4a8;
  line-height: 1.5;
}

.submit-button {
  height: 84rpx;
  margin: 28rpx 0 0;
  color: #071112;
  font-size: 28rpx;
  font-weight: 800;
  line-height: 84rpx;
  background: #f6c453;
  border-radius: 8rpx;
}
</style>
