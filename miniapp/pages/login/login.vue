<template>
  <view class="page">
    <text class="title">登录</text>
    <text class="copy">使用微信授权登录，昵称和头像会保存到交换平台账号。</text>

    <button class="avatar-button" open-type="chooseAvatar" @chooseavatar="chooseAvatar">
      <image v-if="avatarUrl" class="avatar" :src="avatarUrl" mode="aspectFill" />
      <text v-else class="avatar-placeholder">选择头像</text>
    </button>

    <input v-model="displayName" class="input" type="nickname" placeholder="请输入微信昵称" />
    <button class="primary-action" :loading="loading" :disabled="loading" @tap="login">微信登录</button>
  </view>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { wechatLogin } from "../../api/client";
import { saveSession } from "../../auth/session";

type ChooseAvatarEvent = {
  detail?: {
    avatarUrl?: string;
  };
};

const displayName = ref("");
const avatarUrl = ref("");
const loading = ref(false);

function chooseAvatar(event: ChooseAvatarEvent) {
  const value = event.detail?.avatarUrl;
  if (value) {
    avatarUrl.value = value;
  }
}

function getWeixinLoginCode(): Promise<string> {
  return new Promise((resolve, reject) => {
    uni.login({
      provider: "weixin",
      success(result) {
        if (result.code) {
          resolve(result.code);
          return;
        }

        reject(new Error("未获取到微信登录凭证"));
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

  return "微信登录失败，请稍后重试";
}

async function login() {
  const nickname = displayName.value.trim();
  if (!nickname) {
    uni.showToast({ title: "请填写微信昵称", icon: "none" });
    return;
  }

  loading.value = true;
  try {
    const code = await getWeixinLoginCode();
    const result = await wechatLogin({
      code,
      displayName: nickname,
      avatarUrl: avatarUrl.value || undefined
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

.input {
  box-sizing: border-box;
  width: 100%;
  height: 88rpx;
  margin-bottom: 24rpx;
  padding: 0 20rpx;
  border: 1px solid #d0d5dd;
  border-radius: 8rpx;
}

.avatar-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 144rpx;
  height: 144rpx;
  padding: 0;
  margin: 0 0 24rpx;
  overflow: hidden;
  background: #eef4ff;
  border: 1px solid #b2ccff;
  border-radius: 72rpx;
}

.avatar-button::after {
  border: 0;
}

.avatar,
.avatar-placeholder {
  width: 144rpx;
  height: 144rpx;
}

.avatar-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24rpx;
  color: #175cd3;
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

.input {
  color: #f5f0dc;
  background: rgba(8, 24, 23, 0.94);
  border-color: rgba(134, 239, 172, 0.24);
}

.avatar-button {
  background: linear-gradient(145deg, rgba(16, 42, 38, 0.96), rgba(8, 19, 20, 0.98));
  border-color: rgba(246, 196, 83, 0.42);
  box-shadow: 0 14rpx 32rpx rgba(0, 0, 0, 0.30), inset 0 1rpx 0 rgba(255, 255, 255, 0.14);
}

.avatar-placeholder {
  color: #ffd66b;
}
</style>
