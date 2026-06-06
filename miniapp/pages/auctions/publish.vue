<template>
  <view class="page">
    <view class="header">
      <text class="title">提交资产</text>
      <text class="summary">提交后进入主理人后台审核，通过后才会上架。</text>
    </view>

    <view v-if="!publishEnabled" class="switch-note">
      <text>{{ publishDisabledReason }}</text>
    </view>
    <view v-else-if="remainingDailyPublishCount <= 0" class="switch-note">
      <text>今日发布次数已用完，请明天再试。</text>
    </view>

    <view class="form-panel">
      <view class="field">
        <text class="field-label">游戏</text>
        <picker mode="selector" :range="gameOptions" :value="selectedGameIndex" @change="onGameChange">
          <view class="picker-value">{{ form.gameName }}</view>
        </picker>
      </view>
      <label class="field">
        <text class="field-label">区服</text>
        <input v-model="form.serverName" class="input" placeholder="例如：17 区" />
      </label>
      <label class="field">
        <text class="field-label">卖家游戏 ID</text>
        <input v-model="form.sellerGameId" class="input" placeholder="仅后台审核可见，可选" />
      </label>

      <view class="field">
        <text class="field-label">资产类型</text>
        <picker mode="selector" :range="assetTypes" :value="selectedAssetTypeIndex" @change="onAssetTypeChange">
          <view class="picker-value">{{ form.assetType }}</view>
        </picker>
      </view>

      <view v-if="form.assetType === '道具'" class="field">
        <text class="field-label">道具分类</text>
        <picker mode="selector" :range="itemCategoryLabels" :value="selectedItemCategoryIndex" @change="onItemCategoryChange">
          <view class="picker-value">{{ selectedItemCategoryLabel }}</view>
        </picker>
      </view>

      <view v-if="isDragonBallItem" class="dragon-ball-fields">
        <text class="section-title">龙珠属性</text>
        <view class="dragon-ball-grid">
          <view class="field compact-field">
            <text class="field-label">职业</text>
            <picker
              mode="selector"
              :range="dragonBallProfessionOptions"
              :value="selectedDragonBallProfessionIndex"
              @change="onDragonBallProfessionChange"
            >
              <view class="picker-value">{{ form.dragonBallProfession }}</view>
            </picker>
          </view>
          <view class="field compact-field">
            <text class="field-label">品质</text>
            <picker
              mode="selector"
              :range="dragonBallQualityOptions"
              :value="selectedDragonBallQualityIndex"
              @change="onDragonBallQualityChange"
            >
              <view class="picker-value">{{ form.dragonBallQuality }}品质</view>
            </picker>
          </view>
        </view>
        <label class="field compact-field">
          <text class="field-label">属性</text>
          <input v-model="form.dragonBallAttributes" class="input" placeholder="例如：附加伤害+0%，无视冰甲+0%" />
        </label>
      </view>

      <view class="field">
        <text class="field-label">主理人</text>
        <picker mode="selector" :range="principalLabels" :value="selectedPrincipalIndex" @change="onPrincipalChange">
          <view class="picker-value">{{ selectedPrincipalLabel }}</view>
        </picker>
      </view>

      <label class="field">
        <text class="field-label">标题</text>
        <input v-model="form.title" class="input" maxlength="80" placeholder="一句话说明资产亮点" />
      </label>
      <label class="field">
        <text class="field-label">描述</text>
        <textarea v-model="form.description" class="textarea" maxlength="500" placeholder="补充等级、资源、备注等必要信息" />
      </label>

      <view class="price-grid">
        <label class="field">
          <text class="field-label">起拍价（元宝）</text>
          <input v-model="form.startingPriceYuan" class="input" type="number" placeholder="例如：100" />
        </label>
        <label class="field">
          <text class="field-label">最低加价（元宝）</text>
          <input v-model="form.minIncrementYuan" class="input" type="number" placeholder="例如：1" />
        </label>
      </view>

      <view class="image-section">
        <view class="image-heading">
          <text class="field-label">资产图片</text>
          <text class="image-count">{{ imagePaths.length }}/{{ maxImagesPerAsset }}</text>
        </view>
        <view class="image-grid">
          <view v-for="(path, index) in imagePaths" :key="path" class="image-tile">
            <image class="asset-image" :src="path" mode="aspectFill" />
            <button class="remove-image" @tap="removeImage(index)">删除</button>
          </view>
          <button
            v-if="imagePaths.length < maxImagesPerAsset"
            class="add-image"
            :loading="uploadingImages"
            :disabled="uploadingImages || !publishEnabled"
            @tap="chooseImages"
          >
            添加图片
          </button>
        </view>
      </view>
    </view>

    <button class="submit-button" :loading="submitting" :disabled="submitDisabled" @tap="submit">
      提交审核
    </button>
  </view>
</template>

<script setup lang="ts">
import {
  dragonBallProfessionOptions,
  dragonBallQualityOptions,
  parseYuanToCents,
  type PrincipalSummary
} from "@auction/shared";
import { onLoad, onShow } from "@dcloudio/uni-app";
import { computed, reactive, ref } from "vue";
import {
  createAsset,
  getAssetPublishContext,
  uploadAssetImage,
  type UploadedAssetImage
} from "../../api/client";
import { assetTypes, normalizeAssetType, type AssetType } from "../../utils/assetType";
import { defaultGameName, gameOptions, normalizeGameName, type GameName } from "../../utils/gameOptions";
import { detectImageMimeType } from "../../utils/imageMime";
import { appendAssetImagePaths, MAX_ASSET_IMAGES, removeAssetImagePathAt } from "../../utils/imageSelection";
import { normalizePrincipalSelection } from "../../utils/principalSelection";
import { restrictedActionFailureMessage } from "../../utils/userActionErrors";
import { normalizeUserAssetSubmitDisabledReason, USER_ASSET_SUBMIT_DISABLED_REASON } from "../../utils/assetPublishCopy";

type ItemCategory = "" | "龙珠";

const itemCategoryOptions: Array<{ value: ItemCategory; label: string }> = [
  { value: "", label: "普通道具" },
  { value: "龙珠", label: "龙珠" }
];
const itemCategoryLabels = itemCategoryOptions.map((option) => option.label);

const form = reactive({
  gameName: defaultGameName as GameName,
  serverName: "",
  sellerGameId: "",
  assetType: "账号" as AssetType,
  itemCategory: "" as ItemCategory,
  dragonBallProfession: dragonBallProfessionOptions[0] ?? "",
  dragonBallQuality: dragonBallQualityOptions[3] ?? dragonBallQualityOptions[0] ?? "",
  dragonBallAttributes: "附加伤害+0%，无视冰甲+0%",
  principalId: "",
  title: "",
  description: "",
  startingPriceYuan: "",
  minIncrementYuan: "1"
});

const principals = ref<PrincipalSummary[]>([]);
const publishEnabled = ref(false);
const publishDisabledReason = ref(USER_ASSET_SUBMIT_DISABLED_REASON);
const remainingDailyPublishCount = ref(0);
const maxImagesPerAsset = ref(MAX_ASSET_IMAGES);
const imagePaths = ref<string[]>([]);
const uploadedImages = ref<UploadedAssetImage[]>([]);
const uploadingImages = ref(false);
const submitting = ref(false);

const selectedGameIndex = computed(() => Math.max(0, gameOptions.findIndex((gameName) => gameName === form.gameName)));
const selectedAssetTypeIndex = computed(() => Math.max(0, assetTypes.findIndex((type) => type === form.assetType)));
const selectedItemCategoryIndex = computed(() =>
  Math.max(0, itemCategoryOptions.findIndex((option) => option.value === form.itemCategory))
);
const selectedItemCategoryLabel = computed(() => itemCategoryOptions[selectedItemCategoryIndex.value]?.label ?? "普通道具");
const isDragonBallItem = computed(() => form.assetType === "道具" && form.itemCategory === "龙珠");
const selectedDragonBallProfessionIndex = computed(() =>
  Math.max(0, dragonBallProfessionOptions.findIndex((profession) => profession === form.dragonBallProfession))
);
const selectedDragonBallQualityIndex = computed(() =>
  Math.max(0, dragonBallQualityOptions.findIndex((quality) => quality === form.dragonBallQuality))
);
const principalLabels = computed(() => principals.value.map((principal) => principal.displayName));
const selectedPrincipalIndex = computed(() => {
  const index = principals.value.findIndex((principal) => principal.id === form.principalId);
  return index >= 0 ? index : 0;
});
const selectedPrincipalLabel = computed(() => principals.value[selectedPrincipalIndex.value]?.displayName ?? "暂无可选主理人");
const submitDisabled = computed(
  () => submitting.value || uploadingImages.value || !publishEnabled.value || remainingDailyPublishCount.value <= 0
);

onLoad((query) => {
  const queryAssetType = normalizeAssetType(query?.assetType);
  if (queryAssetType) {
    form.assetType = queryAssetType;
  }
  const queryGameName = normalizeGameName(query?.gameName);
  if (queryGameName) {
    form.gameName = queryGameName;
  }
});

onShow(() => {
  void loadContext();
});

async function loadContext() {
  try {
    const response = await getAssetPublishContext();
    publishEnabled.value = response.enabled;
    publishDisabledReason.value = normalizeUserAssetSubmitDisabledReason(response.disabledReason);
    remainingDailyPublishCount.value = response.remainingDailyPublishCount;
    maxImagesPerAsset.value = response.imagePolicy.maxImagesPerAsset;
    principals.value = response.principals;
    form.minIncrementYuan = String(Math.max(1, Math.floor(response.defaultMinIncrementCents / 100)));
    form.principalId = normalizePrincipalSelection(response.principals, form.principalId) || response.principals[0]?.id || "";
  } catch {
    publishEnabled.value = false;
    publishDisabledReason.value = "请先登录后再提交资产";
    remainingDailyPublishCount.value = 0;
    principals.value = [];
  }
}

function readPickerIndex(event: { detail?: { value?: unknown } }): number {
  const value = event.detail?.value;
  const index = typeof value === "number" ? value : Number(value);
  return Number.isInteger(index) && index >= 0 ? index : 0;
}

function onGameChange(event: { detail?: { value?: unknown } }) {
  const index = readPickerIndex(event);
  form.gameName = gameOptions[index] ?? defaultGameName;
}

function onAssetTypeChange(event: { detail?: { value?: unknown } }) {
  const index = readPickerIndex(event);
  form.assetType = assetTypes[index] ?? "账号";
  if (form.assetType !== "道具") {
    form.itemCategory = "";
  }
  imagePaths.value = [];
  uploadedImages.value = [];
}

function onItemCategoryChange(event: { detail?: { value?: unknown } }) {
  const index = readPickerIndex(event);
  form.itemCategory = itemCategoryOptions[index]?.value ?? "";
}

function onDragonBallProfessionChange(event: { detail?: { value?: unknown } }) {
  const index = readPickerIndex(event);
  form.dragonBallProfession = dragonBallProfessionOptions[index] ?? dragonBallProfessionOptions[0] ?? "";
}

function onDragonBallQualityChange(event: { detail?: { value?: unknown } }) {
  const index = readPickerIndex(event);
  form.dragonBallQuality = dragonBallQualityOptions[index] ?? dragonBallQualityOptions[0] ?? "";
}

function onPrincipalChange(event: { detail?: { value?: unknown } }) {
  const index = readPickerIndex(event);
  form.principalId = principals.value[index]?.id ?? "";
}

function chooseImages() {
  if (uploadingImages.value || !publishEnabled.value) {
    return;
  }
  uni.chooseImage({
    count: Math.max(0, maxImagesPerAsset.value - imagePaths.value.length),
    success(result) {
      const selectedPaths = normalizeTempFilePaths(result.tempFilePaths);
      const appended = appendAssetImagePaths(imagePaths.value, selectedPaths, maxImagesPerAsset.value);
      if (appended.rejectedCount > 0) {
        uni.showToast({ title: `最多上传 ${maxImagesPerAsset.value} 张图片`, icon: "none" });
      }
      const acceptedPaths = appended.paths.slice(imagePaths.value.length);
      void uploadSelectedImages(acceptedPaths);
    }
  });
}

function normalizeTempFilePaths(value: string | string[] | undefined): string[] {
  if (Array.isArray(value)) {
    return value;
  }
  return typeof value === "string" && value ? [value] : [];
}

async function uploadSelectedImages(paths: string[]) {
  if (paths.length === 0) {
    return;
  }
  uploadingImages.value = true;
  try {
    for (const path of paths) {
      const base64Data = await readFileAsBase64(path);
      const mimeType = detectImageMimeType(base64Data);
      if (!mimeType) {
        uni.showToast({ title: "仅支持 JPG、PNG、WEBP 图片", icon: "none" });
        continue;
      }
      const response = await uploadAssetImage({ assetType: form.assetType, mimeType, base64Data });
      imagePaths.value = [...imagePaths.value, path];
      uploadedImages.value = [...uploadedImages.value, response.image];
    }
  } catch (error) {
    uni.showToast({ title: readActionError(error, "图片上传失败"), icon: "none" });
  } finally {
    uploadingImages.value = false;
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

function removeImage(index: number) {
  imagePaths.value = removeAssetImagePathAt(imagePaths.value, index);
  uploadedImages.value = uploadedImages.value.filter((_image, currentIndex) => currentIndex !== index);
}

function readActionError(error: unknown, fallback: string) {
  if (error instanceof Error && error.message === "User asset publishing is temporarily disabled") {
    return USER_ASSET_SUBMIT_DISABLED_REASON;
  }
  if (error instanceof Error && error.message === "WeChat openid is required for content safety check") {
    return "请重新登录后上传";
  }
  if (error instanceof Error && error.message.includes("用户发布资产")) {
    return USER_ASSET_SUBMIT_DISABLED_REASON;
  }
  if (error instanceof Error && error.message === "Daily publish limit exceeded") {
    return "今日发布次数已用完，请明天再试";
  }
  const restricted = restrictedActionFailureMessage(error, "publish", "");
  if (restricted) {
    return restricted;
  }
  return error instanceof Error && error.message.trim() ? error.message : fallback;
}

function validateForm(): { ok: true; startingPriceCents: number; minIncrementCents: number } | { ok: false; message: string } {
  if (!form.gameName.trim() || !form.serverName.trim() || !form.title.trim() || !form.description.trim()) {
    return { ok: false, message: "请填写游戏、区服、标题和描述" };
  }
  if (!form.principalId) {
    return { ok: false, message: "请选择主理人" };
  }
  if (
    isDragonBallItem.value &&
    (!form.dragonBallProfession || !form.dragonBallQuality || !form.dragonBallAttributes.trim())
  ) {
    return { ok: false, message: "请填写龙珠职业、品质和属性" };
  }
  try {
    const startingPriceCents = parseYuanToCents(form.startingPriceYuan);
    const minIncrementCents = parseYuanToCents(form.minIncrementYuan);
    if (startingPriceCents <= 0 || minIncrementCents <= 0) {
      return { ok: false, message: "价格需填写正整数元宝" };
    }
    return {
      ok: true,
      startingPriceCents,
      minIncrementCents
    };
  } catch {
    return { ok: false, message: "价格需填写正整数元宝" };
  }
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
    const dragonBall = isDragonBallItem.value
      ? {
          profession: form.dragonBallProfession,
          quality: form.dragonBallQuality,
          attributes: form.dragonBallAttributes.trim()
        }
      : undefined;
    const response = await createAsset({
      principalId: form.principalId,
      sellerGameId: form.sellerGameId.trim() || undefined,
      gameName: form.gameName.trim(),
      serverName: form.serverName.trim(),
      assetType: form.assetType,
      itemCategory: form.assetType === "道具" ? form.itemCategory || undefined : undefined,
      dragonBall: dragonBall,
      title: form.title.trim(),
      description: form.description.trim(),
      startingPriceCents: validation.startingPriceCents,
      minIncrementCents: validation.minIncrementCents,
      images: uploadedImages.value.map((image) => ({
        objectKey: image.objectKey,
        publicUrl: image.publicUrl,
        mimeType: image.mimeType,
        sizeBytes: image.sizeBytes
      }))
    });
    uni.showToast({ title: "已提交审核", icon: "none" });
    uni.redirectTo({ url: `/pages/auctions/detail?assetId=${response.asset.id}` });
  } catch (error) {
    uni.showToast({ title: readActionError(error, "提交失败，请稍后重试"), icon: "none" });
  } finally {
    submitting.value = false;
  }
}
</script>

<style scoped>
.page {
  box-sizing: border-box;
  min-height: 100vh;
  padding: 32rpx 24rpx calc(48rpx + env(safe-area-inset-bottom));
  background:
    linear-gradient(145deg, rgba(20, 184, 166, 0.16), transparent 34%),
    linear-gradient(26deg, rgba(246, 196, 83, 0.17), transparent 44%),
    repeating-linear-gradient(90deg, rgba(245, 240, 220, 0.04) 0, rgba(245, 240, 220, 0.04) 1px, transparent 1px, transparent 46rpx),
    #071112;
}

.title,
.summary,
.switch-note,
.field-label,
.image-count {
  display: block;
}

.header {
  margin-bottom: 20rpx;
}

.title {
  font-size: 36rpx;
  font-weight: 800;
  color: #f7e8b6;
  text-shadow: 0 4rpx 18rpx rgba(246, 196, 83, 0.22);
}

.summary {
  margin-top: 8rpx;
  line-height: 1.5;
  color: #9ab4a8;
}

.switch-note {
  padding: 18rpx 20rpx;
  margin-bottom: 18rpx;
  color: #f7e8b6;
  background: rgba(246, 196, 83, 0.10);
  border: 1px solid rgba(246, 196, 83, 0.24);
  border-radius: 8rpx;
}

.form-panel {
  padding: 24rpx;
  background: linear-gradient(145deg, rgba(16, 42, 38, 0.96), rgba(8, 19, 20, 0.98));
  border: 1px solid rgba(246, 196, 83, 0.26);
  border-radius: 8rpx;
  box-shadow: 0 14rpx 32rpx rgba(0, 0, 0, 0.26), inset 0 1rpx 0 rgba(255, 255, 255, 0.10);
}

.field {
  display: block;
  margin-bottom: 22rpx;
}

.compact-field {
  margin-bottom: 0;
}

.field-label {
  margin-bottom: 10rpx;
  font-size: 26rpx;
  font-weight: 800;
  color: #f7e8b6;
}

.section-title {
  display: block;
  margin-bottom: 16rpx;
  font-size: 26rpx;
  font-weight: 900;
  color: #f7e8b6;
}

.input,
.textarea,
.picker-value {
  box-sizing: border-box;
  width: 100%;
  min-height: 76rpx;
  padding: 18rpx 20rpx;
  line-height: 1.4;
  color: #f7e8b6;
  background: rgba(7, 17, 18, 0.68);
  border: 1px solid rgba(154, 180, 168, 0.28);
  border-radius: 8rpx;
}

.textarea {
  min-height: 188rpx;
}

.dragon-ball-fields {
  padding: 18rpx;
  margin-bottom: 22rpx;
  border: 1px dashed rgba(246, 196, 83, 0.34);
  border-radius: 8rpx;
}

.dragon-ball-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16rpx;
  margin-bottom: 16rpx;
}

.price-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16rpx;
}

.image-section {
  margin-top: 4rpx;
}

.image-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12rpx;
}

.image-count {
  color: #9ab4a8;
}

.image-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12rpx;
}

.image-tile,
.asset-image,
.add-image {
  width: 100%;
  aspect-ratio: 1;
}

.image-tile {
  position: relative;
  overflow: hidden;
  border: 1px solid rgba(246, 196, 83, 0.24);
  border-radius: 8rpx;
}

.asset-image {
  display: block;
}

.remove-image {
  position: absolute;
  right: 6rpx;
  bottom: 6rpx;
  height: 42rpx;
  margin: 0;
  padding: 0 12rpx;
  font-size: 22rpx;
  line-height: 42rpx;
  color: #fff;
  background: rgba(185, 28, 28, 0.92);
  border-radius: 6rpx;
}

.add-image {
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0;
  font-size: 26rpx;
  font-weight: 800;
  color: #f7e8b6;
  background: rgba(7, 17, 18, 0.68);
  border: 1px dashed rgba(246, 196, 83, 0.42);
  border-radius: 8rpx;
}

.remove-image::after,
.add-image::after {
  border: 0;
}

.submit-button {
  height: 84rpx;
  margin-top: 28rpx;
  font-size: 30rpx;
  font-weight: 900;
  line-height: 84rpx;
  color: #071112;
  background: linear-gradient(180deg, #ffe08a, #d99620);
  border-radius: 8rpx;
}

.submit-button::after {
  border: 0;
}

.submit-button[disabled] {
  color: rgba(7, 17, 18, 0.58);
  background: rgba(154, 180, 168, 0.42);
}
</style>
