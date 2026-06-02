<template>
  <view class="page">
    <text class="title">发布{{ assetType }}</text>
    <view class="context-row">
      <text>{{ gameName }} / {{ assetType }}</text>
    </view>
    <view class="privacy-note">
      <text class="privacy-title">隐私说明</text>
      <text class="privacy-text">标题、描述、图片、估价和主理人选择会用于信息展示、内容安全审核和交换沟通；请勿上传手机号、身份证号、住址等无关敏感信息。</text>
    </view>
    <view class="field-label required">主理人</view>
    <picker
      mode="selector"
      :range="principalNames"
      :value="selectedPrincipalIndex"
      :disabled="principalPickerDisabled"
      @change="onPrincipalChange"
    >
      <view class="picker-field" :class="{ placeholder: !selectedPrincipalId, disabled: principalPickerDisabled }">
        {{ selectedPrincipalName || principalPickerPlaceholder }}
      </view>
    </picker>
    <input v-model="form.serverName" class="input" placeholder="区服，如华东一区、天空岛" />
    <input v-model="form.title" class="input" placeholder="交换标题" />
    <textarea v-model="form.description" class="textarea" placeholder="描述宝贝亮点、截图说明和限制条件" />
    <view v-if="isPropAsset" class="dragon-ball-panel">
      <view class="field-label">道具分类</view>
      <picker mode="selector" :range="itemCategoryOptions" :value="selectedItemCategoryIndex" :disabled="submitting" @change="onItemCategoryChange">
        <view class="picker-field">{{ itemCategory }}</view>
      </picker>
      <view v-if="isDragonBallCategory">
        <view class="field-label required">职业</view>
        <picker
          mode="selector"
          :range="dragonBallProfessionNames"
          :value="selectedDragonBallProfessionIndex"
          :disabled="submitting"
          @change="onDragonBallProfessionChange"
        >
          <view class="picker-field">{{ selectedDragonBallProfessionName }}</view>
        </picker>
        <view class="field-label required">品质</view>
        <picker
          mode="selector"
          :range="dragonBallQualityNames"
          :value="selectedDragonBallQualityIndex"
          :disabled="submitting"
          @change="onDragonBallQualityChange"
        >
          <view class="picker-field">{{ dragonBallForm.quality }}</view>
        </picker>
        <view class="field-label required">属性</view>
        <input v-model="dragonBallForm.attributes" class="input" placeholder="附加伤害+10%，无视冰甲+5%" />
      </view>
    </view>
    <input v-model="form.startingPriceYuan" class="input" type="number" placeholder="起估价，单位元宝" />
    <input v-model="form.minIncrementYuan" class="input" type="number" placeholder="最低加价，单位元宝" />
    <view class="image-panel">
      <view class="image-heading">
        <text class="image-title">宝贝图片 {{ imagePaths.length }}/{{ maxAssetImages }}</text>
        <button class="secondary-action" :disabled="imagePaths.length >= maxAssetImages || submitting" @tap="chooseImages">选择图片</button>
      </view>
      <text v-if="imagePaths.length === 0" class="image-hint">最多上传 9 张 JPG/PNG/WebP 图片。</text>
      <view v-else class="image-grid">
        <view v-for="(path, index) in imagePaths" :key="path" class="preview-item">
          <image class="preview" :src="path" mode="aspectFill" />
          <button class="remove-image" :disabled="submitting" @tap="removeSelectedImage(index)">删除</button>
        </view>
      </view>
    </view>
    <button class="primary-action" :loading="submitting" :disabled="submitting" @tap="submitDraft">提交审核</button>
  </view>
</template>

<script setup lang="ts">
import { onLoad } from "@dcloudio/uni-app";
import { computed, reactive, ref } from "vue";
import { createAsset, listPrincipals, uploadImage, type CreateAssetRequest, type UploadedImage } from "../../api/client";
import {
  dragonBallElementForProfession,
  dragonBallProfessionOptions,
  dragonBallQualityOptions,
  type DragonBallProfession,
  type DragonBallQuality,
  type PrincipalSummary
} from "@auction/shared";
import { confirmTradingDisclaimer } from "../../utils/disclaimer";
import { detectImageMimeType, imageExtensionForMimeType, type SupportedImageMimeType } from "../../utils/imageMime";
import { MAX_ASSET_IMAGES, appendAssetImagePaths, removeAssetImagePathAt } from "../../utils/imageSelection";
import { normalizeAssetType, type AssetType } from "../../utils/assetType";
import { normalizePrincipalSelection, requireSelectedPrincipalId } from "../../utils/principalSelection";
import { restrictedActionFailureMessage } from "../../utils/userActionErrors";

const submitting = ref(false);
const imagePaths = ref<string[]>([]);
const maxAssetImages = MAX_ASSET_IMAGES;
const maxImageSizeBytes = 5 * 1024 * 1024;
const gameName = ref("塔防精灵");
const assetType = ref<AssetType>("账号");
const principals = ref<PrincipalSummary[]>([]);
const selectedPrincipalId = ref("");
const itemCategoryOptions = ["普通道具", "龙珠"] as const;
const dragonBallProfessionNames = dragonBallProfessionOptions.map((profession) => {
  const element = dragonBallElementForProfession(profession);
  return element ? `${profession}（${element}系）` : profession;
});
const dragonBallQualityNames = [...dragonBallQualityOptions];
const defaultDragonBallProfession = dragonBallProfessionOptions[0] ?? "战士";
const defaultDragonBallQuality = dragonBallQualityOptions[0] ?? "绿";
const itemCategory = ref<(typeof itemCategoryOptions)[number]>("普通道具");
const dragonBallForm = reactive({
  profession: defaultDragonBallProfession as DragonBallProfession,
  quality: defaultDragonBallQuality as DragonBallQuality,
  attributes: ""
});
const form = reactive({
  serverName: "",
  title: "",
  description: "",
  startingPriceYuan: "",
  minIncrementYuan: "1"
});

type PickerChangeEvent = {
  detail: {
    value: string | number;
  };
};

const principalNames = computed(() => principals.value.map((principal) => principal.displayName));
const selectedPrincipalIndex = computed(() => {
  const index = principals.value.findIndex((principal) => principal.id === selectedPrincipalId.value);
  return index >= 0 ? index : 0;
});
const selectedPrincipalName = computed(
  () => principals.value.find((principal) => principal.id === selectedPrincipalId.value)?.displayName ?? ""
);
const principalPickerDisabled = computed(() => principals.value.length === 0 || submitting.value);
const principalPickerPlaceholder = computed(() => (principals.value.length === 0 ? "暂无可选主理人" : "请选择主理人（必填）"));
const isPropAsset = computed(() => assetType.value === "道具");
const isDragonBallCategory = computed(() => isPropAsset.value && itemCategory.value === "龙珠");
const selectedItemCategoryIndex = computed(() => itemCategoryOptions.findIndex((option) => option === itemCategory.value));
const selectedDragonBallProfessionIndex = computed(() =>
  Math.max(0, dragonBallProfessionOptions.findIndex((profession) => profession === dragonBallForm.profession))
);
const selectedDragonBallProfessionName = computed(() => dragonBallProfessionNames[selectedDragonBallProfessionIndex.value] ?? "");
const selectedDragonBallQualityIndex = computed(() =>
  Math.max(0, dragonBallQualityOptions.findIndex((quality) => quality === dragonBallForm.quality))
);

function readFileBase64(path: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const fs = uni.getFileSystemManager();
    fs.readFile({
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

function readFileSize(path: string): Promise<number | null> {
  return new Promise((resolve) => {
    uni.getFileInfo({
      filePath: path,
      success(result) {
        resolve(typeof result.size === "number" ? result.size : null);
      },
      fail() {
        resolve(null);
      }
    });
  });
}

onLoad((query) => {
  if (typeof query?.gameName === "string" && query.gameName.trim()) {
    gameName.value = decodeURIComponent(query.gameName);
  }
  const queryAssetType = normalizeAssetType(query?.assetType);
  if (queryAssetType) {
    assetType.value = queryAssetType;
  }
  void loadPrincipals();
});

function onPrincipalChange(event: PickerChangeEvent) {
  const index = Number(event.detail.value);
  const principal = Number.isInteger(index) ? principals.value[index] : undefined;
  selectedPrincipalId.value = principal?.id ?? "";
}

function onItemCategoryChange(event: PickerChangeEvent) {
  const index = Number(event.detail.value);
  itemCategory.value = Number.isInteger(index) ? itemCategoryOptions[index] ?? "普通道具" : "普通道具";
  if (itemCategory.value !== "龙珠") {
    dragonBallForm.attributes = "";
  }
}

function onDragonBallProfessionChange(event: PickerChangeEvent) {
  const index = Number(event.detail.value);
  dragonBallForm.profession = dragonBallProfessionOptions[index] ?? defaultDragonBallProfession;
}

function onDragonBallQualityChange(event: PickerChangeEvent) {
  const index = Number(event.detail.value);
  dragonBallForm.quality = dragonBallQualityOptions[index] ?? defaultDragonBallQuality;
}

async function loadPrincipals() {
  try {
    const response = await listPrincipals();
    principals.value = response.items;
    selectedPrincipalId.value = normalizePrincipalSelection(response.items, selectedPrincipalId.value);
  } catch {
    principals.value = [];
    selectedPrincipalId.value = "";
    uni.showToast({ title: "主理人列表加载失败", icon: "none" });
  }
}

async function chooseImages() {
  const remaining = maxAssetImages - imagePaths.value.length;
  if (remaining <= 0) {
    return;
  }

  uni.chooseImage({
    count: remaining,
    sizeType: ["compressed"],
    sourceType: ["album", "camera"],
    success(result) {
      const selectedPaths = Array.isArray(result.tempFilePaths) ? result.tempFilePaths : [result.tempFilePaths].filter(Boolean);
      const appended = appendAssetImagePaths(imagePaths.value, selectedPaths, maxAssetImages);
      imagePaths.value = appended.paths;
      if (appended.rejectedCount > 0) {
        uni.showToast({ title: `最多选择 ${maxAssetImages} 张图片`, icon: "none" });
      }
    }
  });
}

function removeSelectedImage(index: number) {
  if (submitting.value) {
    return;
  }
  imagePaths.value = removeAssetImagePathAt(imagePaths.value, index);
}

function yuanToCents(value: string) {
  const trimmed = value.trim();
  if (!/^[1-9]\d*$/.test(trimmed)) {
    return null;
  }

  const amount = Number(trimmed);
  if (!Number.isSafeInteger(amount) || amount > Math.floor(Number.MAX_SAFE_INTEGER / 100)) {
    return null;
  }

  return amount * 100;
}

function clearForm() {
  form.serverName = "";
  form.title = "";
  form.description = "";
  form.startingPriceYuan = "";
  form.minIncrementYuan = "1";
  itemCategory.value = "普通道具";
  dragonBallForm.profession = defaultDragonBallProfession;
  dragonBallForm.quality = defaultDragonBallQuality;
  dragonBallForm.attributes = "";
  imagePaths.value = [];
}

function imageFileNameForPath(path: string, mimeType: SupportedImageMimeType): string {
  const originalName = path.split("/").pop() || "asset";
  const stem = originalName.replace(/\.[^.]+$/, "") || "asset";
  return `${stem}.${imageExtensionForMimeType(mimeType)}`;
}

async function uploadSelectedImages(): Promise<UploadedImage[]> {
  const uploaded: UploadedImage[] = [];
  for (const [index, path] of imagePaths.value.entries()) {
    try {
      const sizeBytes = await readFileSize(path);
      if (sizeBytes !== null && sizeBytes > maxImageSizeBytes) {
        throw new Error(`第 ${index + 1} 张图片超过 5MB`);
      }

      const base64Data = await readFileBase64(path);
      const mimeType = detectImageMimeType(base64Data);
      if (!mimeType) {
        throw new Error(`第 ${index + 1} 张图片格式不支持`);
      }

      const response = await uploadImage({
        assetType: assetType.value,
        fileName: imageFileNameForPath(path, mimeType),
        mimeType,
        base64Data
      });
      uploaded.push(response.image);
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("第 ")) {
        throw error;
      }
      throw new Error(`第 ${index + 1} 张图片上传失败`);
    }
  }
  return uploaded;
}

function submitErrorTitle(error: unknown): string {
  if (!(error instanceof Error)) {
    return "提交失败，请确认信息和登录状态";
  }
  if (error.message.startsWith("第 ")) {
    return error.message;
  }
  if (error.message === "Daily publish limit reached") {
    return "今日发布次数已达上限";
  }
  if (error.message === "Credit score is too low for this action") {
    return "信誉分不足，暂不能发布信息";
  }
  return restrictedActionFailureMessage(error, "publish", "提交失败，请确认信息和登录状态");
}

function buildItemMetadata(): { ok: true; payload: Pick<CreateAssetRequest, "itemCategory" | "dragonBall"> } | { ok: false; message: string } {
  if (!isDragonBallCategory.value) {
    return { ok: true, payload: {} };
  }

  const attributes = dragonBallForm.attributes.trim();
  if (!attributes) {
    return { ok: false, message: "请填写龙珠属性" };
  }
  if (attributes.length > 200) {
    return { ok: false, message: "龙珠属性最多 200 字" };
  }

  return {
    ok: true,
    payload: {
      itemCategory: "龙珠",
      dragonBall: {
        profession: dragonBallForm.profession,
        quality: dragonBallForm.quality,
        attributes
      }
    }
  };
}

async function submitDraft() {
  if (submitting.value) {
    return;
  }

  const startingPriceCents = yuanToCents(form.startingPriceYuan);
  const minIncrementCents = yuanToCents(form.minIncrementYuan);
  const principalId = requireSelectedPrincipalId(principals.value, selectedPrincipalId.value);
  if (!principalId) {
    uni.showToast({ title: "请选择主理人", icon: "none" });
    return;
  }
  if (!startingPriceCents || !minIncrementCents) {
    uni.showToast({ title: "请填写有效价格", icon: "none" });
    return;
  }
  const itemMetadata = buildItemMetadata();
  if (!itemMetadata.ok) {
    uni.showToast({ title: itemMetadata.message, icon: "none" });
    return;
  }

  const acceptedDisclaimer = await confirmTradingDisclaimer();
  if (!acceptedDisclaimer) {
    return;
  }

  submitting.value = true;
  try {
    const images = await uploadSelectedImages();
    await createAsset({
      gameName: gameName.value,
      serverName: form.serverName,
      assetType: assetType.value,
      principalId,
      title: form.title,
      description: form.description,
      ...itemMetadata.payload,
      startingPriceCents,
      minIncrementCents,
      images
    });
    clearForm();
    uni.showToast({ title: "已提交审核", icon: "none" });
    uni.redirectTo({
      url: `/pages/auctions/list?gameName=${encodeURIComponent(gameName.value)}&assetType=${encodeURIComponent(assetType.value)}`
    });
  } catch (error) {
    uni.showToast({ title: submitErrorTitle(error), icon: "none" });
  } finally {
    submitting.value = false;
  }
}
</script>

<style scoped>
.page {
  padding: 24rpx;
}

.title {
  display: block;
  margin-bottom: 12rpx;
  font-size: 36rpx;
  font-weight: 700;
  color: #101828;
}

.context-row {
  padding: 18rpx 20rpx;
  margin-bottom: 20rpx;
  color: #175cd3;
  background: #eff8ff;
  border: 1px solid #b2ddff;
  border-radius: 8rpx;
}

.privacy-note {
  padding: 18rpx 20rpx;
  margin-bottom: 20rpx;
  background: #f8fafc;
  border-left: 6rpx solid #175cd3;
  border-radius: 8rpx;
}

.privacy-title,
.privacy-text {
  display: block;
}

.privacy-title {
  margin-bottom: 6rpx;
  font-size: 24rpx;
  font-weight: 700;
  color: #175cd3;
}

.privacy-text {
  font-size: 24rpx;
  line-height: 1.55;
  color: #475467;
}

.field-label {
  display: block;
  margin-bottom: 8rpx;
  font-size: 26rpx;
  font-weight: 600;
  color: #344054;
}

.field-label.required::after {
  margin-left: 6rpx;
  color: #d92d20;
  content: "*";
}

.input,
.picker-field,
.textarea {
  box-sizing: border-box;
  width: 100%;
  margin-bottom: 16rpx;
  padding: 0 20rpx;
  border: 1px solid #d0d5dd;
  border-radius: 8rpx;
}

.input {
  height: 80rpx;
}

.picker-field {
  display: flex;
  align-items: center;
  min-height: 80rpx;
  color: #101828;
}

.placeholder {
  color: #808080;
}

.disabled {
  background: #f2f4f7;
}

.textarea {
  min-height: 220rpx;
  padding-top: 16rpx;
  line-height: 1.5;
}

.image-panel {
  padding: 20rpx;
  margin-bottom: 20rpx;
  border: 1px solid #eaecf0;
  border-radius: 8rpx;
}

.image-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
}

.image-title,
.image-hint {
  display: block;
}

.image-title {
  font-weight: 700;
}

.image-hint {
  margin-top: 12rpx;
  color: #667085;
}

.secondary-action {
  margin: 0;
  color: #175cd3;
  background: #eef4ff;
}

.image-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12rpx;
  margin-top: 16rpx;
}

.preview-item {
  position: relative;
}

.preview {
  width: 100%;
  height: 180rpx;
  border-radius: 8rpx;
  background: #f2f4f7;
}

.remove-image {
  position: absolute;
  top: 8rpx;
  right: 8rpx;
  min-width: 0;
  padding: 4rpx 12rpx;
  margin: 0;
  font-size: 22rpx;
  line-height: 1.4;
  color: #ffffff;
  background: rgba(16, 24, 40, 0.72);
  border-radius: 8rpx;
}

.page {
  min-height: 100vh;
  background:
    linear-gradient(145deg, rgba(20, 184, 166, 0.16), transparent 32%),
    linear-gradient(22deg, rgba(246, 196, 83, 0.18), transparent 44%),
    repeating-linear-gradient(0deg, rgba(245, 240, 220, 0.04) 0, rgba(245, 240, 220, 0.04) 1px, transparent 1px, transparent 48rpx),
    #071112;
}

.title {
  color: #f7e8b6;
  text-shadow: 0 4rpx 18rpx rgba(246, 196, 83, 0.22);
}

.context-row,
.privacy-note,
.dragon-ball-panel,
.image-panel {
  background: linear-gradient(145deg, rgba(16, 42, 38, 0.96), rgba(8, 19, 20, 0.98));
  border-color: rgba(246, 196, 83, 0.28);
  box-shadow: 0 14rpx 32rpx rgba(0, 0, 0, 0.26), inset 0 1rpx 0 rgba(255, 255, 255, 0.10);
}

.context-row {
  color: #8df0c7;
}

.privacy-note {
  border-left-color: #ffd66b;
}

.privacy-title {
  color: #ffd66b;
}

.privacy-text {
  color: #a9c9ba;
}

.field-label,
.image-title {
  color: #ffd66b;
}

.field-label.required::after {
  color: #fb7185;
}

.input,
.picker-field,
.textarea {
  color: #f5f0dc;
  background: rgba(8, 24, 23, 0.94);
  border-color: rgba(134, 239, 172, 0.24);
}

.placeholder,
.image-hint {
  color: #9ab4a8;
}

.disabled {
  color: #70867d;
  background: rgba(15, 29, 29, 0.9);
}

.secondary-action {
  color: #10201d;
  font-weight: 800;
  background: linear-gradient(180deg, #a7f3d0, #34d399);
}

.secondary-action::after,
.remove-image::after {
  border: 0;
}

.preview {
  background: rgba(22, 47, 43, 0.9);
  border: 1px solid rgba(246, 196, 83, 0.22);
}

.remove-image {
  color: #ffe7e0;
  background: rgba(127, 29, 29, 0.78);
}
</style>
