<template>
  <view class="page">
    <text class="title">账号登录</text>
    <text class="copy">完善昵称和头像后进入资源交换平台。</text>
    <view class="privacy-note">
      <text class="privacy-title">隐私说明</text>
      <text class="privacy-text">昵称和头像仅用于平台账号展示、消息提醒和必要身份区分，不会用于无关用途。</text>
    </view>

    <view class="locked-profile">
      <button class="avatar-picker" open-type="chooseAvatar" @chooseavatar="onChooseAvatar">
        <image v-if="avatarUrl" class="avatar" :src="avatarUrl" mode="aspectFill" />
        <view v-else class="avatar avatar-fallback">{{ displayName.slice(0, 1) || "用" }}</view>
      </button>
      <view class="profile-copy">
        <text class="profile-label">昵称</text>
        <view class="nickname-control" :class="{ 'is-selecting': !nicknameLocked }" @tap="focusNicknameInput">
          <view v-if="!nicknameLocked" class="nickname-selector">
            <text class="nickname-selector-text">点击选择昵称</text>
            <input
              class="nickname-native-input"
              type="nickname"
              :focus="nicknameInputFocused"
              :value="nicknameDraft"
              @blur="onNicknameBlur"
              @confirm="onNicknameBlur"
              @input="onNicknameInput"
              @nicknamereview="onNicknameReview"
            />
          </view>
          <text v-else class="nickname-display">{{ displayName }}</text>
        </view>
        <button v-if="nicknameLocked" class="nickname-reset" @tap.stop="resetNickname">重新选择</button>
      </view>
    </view>

    <button class="primary-action" :loading="loading" :disabled="loading" @tap="login">进入平台</button>
  </view>
</template>

<script setup lang="ts">
import { nextTick, ref } from "vue";
import { wechatLogin } from "../../api/client";
import { saveSession } from "../../auth/session";

type ChooseAvatarEvent = { detail?: { avatarUrl?: unknown } };

const displayName = ref("");
const avatarUrl = ref("");
const nicknameDraft = ref("");
const nicknameInputFocused = ref(false);
const nicknameLocked = ref(false);
const loading = ref(false);

function getWeixinLoginCode(): Promise<string> {
  return new Promise((resolve, reject) => {
    uni.login({
      provider: "weixin",
      success(result) {
        if (result.code) {
          resolve(result.code);
          return;
        }

        reject(new Error("未获取到登录凭证"));
      },
      fail(error) {
        reject(error);
      }
    });
  });
}

function readErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  const errMsg = (error as { errMsg?: unknown })?.errMsg;
  if (typeof errMsg === "string" && errMsg.trim()) {
    return errMsg;
  }

  return "登录失败，请稍后重试";
}

function normalizeNickname(value: unknown): string {
  return typeof value === "string" ? value.trim().slice(0, 64) : "";
}

function readInputEventValue(event: unknown): unknown {
  if (typeof event !== "object" || event === null) {
    return undefined;
  }
  const detail = (event as { detail?: unknown }).detail;
  if (typeof detail === "object" && detail !== null && "value" in detail) {
    return (detail as { value?: unknown }).value;
  }
  if (typeof detail === "object" && detail !== null && "nickname" in detail) {
    return (detail as { nickname?: unknown }).nickname;
  }
  const target = (event as { target?: unknown }).target;
  if (typeof target === "object" && target !== null && "value" in target) {
    return (target as { value?: unknown }).value;
  }
  return undefined;
}

function onNicknameInput(event: unknown) {
  nicknameDraft.value = normalizeNickname(readInputEventValue(event));
}

function onNicknameBlur(event: unknown) {
  nicknameInputFocused.value = false;
  const nickname = normalizeNickname(readInputEventValue(event)) || nicknameDraft.value;
  if (nickname) {
    displayName.value = nickname;
    nicknameDraft.value = nickname;
    nicknameLocked.value = true;
  }
}

function onNicknameReview(event: unknown) {
  const nickname = normalizeNickname(readInputEventValue(event));
  if (nickname) {
    displayName.value = nickname;
    nicknameDraft.value = nickname;
    nicknameLocked.value = true;
    nicknameInputFocused.value = false;
  }
}

function focusNicknameInput() {
  if (!nicknameLocked.value) {
    nicknameInputFocused.value = true;
  }
}

function resetNickname() {
  displayName.value = "";
  nicknameDraft.value = "";
  nicknameLocked.value = false;
  nicknameInputFocused.value = false;
  void nextTick(() => {
    nicknameInputFocused.value = true;
  });
}

function onChooseAvatar(event: ChooseAvatarEvent) {
  const selectedAvatarUrl = typeof event.detail?.avatarUrl === "string" ? event.detail.avatarUrl.trim() : "";
  if (selectedAvatarUrl) {
    avatarUrl.value = selectedAvatarUrl;
  }
}

function persistentAvatarUrl(): string | undefined {
  return /^https:\/\//.test(avatarUrl.value.trim()) ? avatarUrl.value.trim() : undefined;
}

async function login() {
  const nickname = displayName.value.trim();
  if (!nickname) {
    uni.showToast({ title: "请先填写昵称", icon: "none" });
    return;
  }

  loading.value = true;
  try {
    const code = await getWeixinLoginCode();
    const result = await wechatLogin({
      code,
      displayName: nickname,
      avatarUrl: persistentAvatarUrl()
    });
    saveSession(result);
    uni.switchTab({ url: "/pages/games/index" });
  } catch (error) {
    uni.showToast({ title: readErrorMessage(error), icon: "none" });
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.page {
  padding: 32rpx;
}

.title {
  display: block;
  margin-bottom: 16rpx;
  font-size: 40rpx;
  font-weight: 700;
  color: #101828;
}

.copy {
  display: block;
  margin-bottom: 24rpx;
  line-height: 1.6;
  color: #667085;
}

.privacy-note {
  padding: 18rpx 20rpx;
  margin-bottom: 24rpx;
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

.locked-profile {
  display: flex;
  align-items: center;
  gap: 18rpx;
  padding: 18rpx;
  margin-bottom: 24rpx;
  border-radius: 8rpx;
}

.avatar-picker {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  width: 104rpx;
  height: 104rpx;
  padding: 0;
  margin: 0;
  overflow: hidden;
  background: transparent;
  border-radius: 52rpx;
}

.avatar-picker::after {
  border: 0;
}

.avatar {
  flex: 0 0 auto;
  width: 104rpx;
  height: 104rpx;
  overflow: hidden;
  border-radius: 52rpx;
}

.avatar-fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 38rpx;
  font-weight: 800;
}

.profile-copy {
  flex: 1;
  min-width: 0;
}

.profile-label {
  display: block;
}

.profile-label {
  margin-bottom: 6rpx;
  font-size: 24rpx;
}

.nickname-control {
  position: relative;
  min-height: 56rpx;
}

.nickname-selector {
  position: relative;
  min-height: 56rpx;
}

.nickname-selector-text {
  display: block;
  overflow: hidden;
  font-size: 32rpx;
  font-weight: 800;
  line-height: 56rpx;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.nickname-display {
  display: block;
  overflow: hidden;
  font-size: 32rpx;
  font-weight: 800;
  line-height: 56rpx;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.nickname-native-input {
  position: absolute;
  inset: 0;
  z-index: 1;
  display: block;
  width: 100%;
  height: 56rpx;
  padding: 0;
  overflow: hidden;
  color: transparent;
  caret-color: transparent;
  opacity: 0.01;
}

.nickname-reset {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 44rpx;
  padding: 0 14rpx;
  margin: 8rpx 0 0;
  font-size: 22rpx;
  line-height: 44rpx;
  border-radius: 8rpx;
}

.nickname-reset::after {
  border: 0;
}

.page {
  min-height: 100vh;
  background:
    linear-gradient(145deg, rgba(20, 184, 166, 0.20), transparent 34%),
    linear-gradient(28deg, rgba(246, 196, 83, 0.18), transparent 44%),
    repeating-linear-gradient(90deg, rgba(245, 240, 220, 0.045) 0, rgba(245, 240, 220, 0.045) 1px, transparent 1px, transparent 46rpx),
    #071112;
}

.title {
  color: #f7e8b6;
  text-shadow: 0 4rpx 18rpx rgba(246, 196, 83, 0.22);
}

.copy {
  color: #9ab4a8;
}

.privacy-note {
  background: rgba(8, 24, 23, 0.86);
  border-left-color: #ffd66b;
}

.privacy-title {
  color: #ffd66b;
}

.privacy-text {
  color: #a9c9ba;
}

.locked-profile {
  background: linear-gradient(145deg, rgba(16, 42, 38, 0.96), rgba(8, 19, 20, 0.98));
  border: 1px solid rgba(246, 196, 83, 0.42);
  box-shadow: 0 14rpx 32rpx rgba(0, 0, 0, 0.30), inset 0 1rpx 0 rgba(255, 255, 255, 0.14);
}

.avatar {
  background: rgba(8, 24, 23, 0.94);
}

.avatar-fallback,
.nickname-display,
.nickname-selector-text {
  color: #ffd66b;
}

.profile-label {
  color: #9ab4a8;
}

.nickname-reset {
  color: #071112;
  background: #f6c453;
}
</style>
