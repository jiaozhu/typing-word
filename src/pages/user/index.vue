<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue";
import { useAuthStore } from "@/stores/auth.ts";
import { useRouter } from "vue-router";
import BaseButton from "@/components/BaseButton.vue";
import Toast from "@/components/base/toast/Toast.ts";
import { uploadImportData, getProgress } from "@/apis/index.ts";

const authStore = useAuthStore();
const router = useRouter();

// 页面状态
const isLoading = ref(false);

// 上传与后台处理状态
const isUploading = ref(false);
const isProcessing = ref(false);
const uploadPercent = ref(0);
const processStatus = ref<number | null>(null); // 0=导入中,1=完成,2=失败
const processReason = ref("");
const processElapsedSec = ref(0);
const hasPendingProcessing = ref(false); // 进入页面首次检查，是否存在后台处理中任务
const pollingAbort = ref(false); // 页面退出时标记，用于结束轮询
const fileInputRef = ref<HTMLInputElement | null>(null);

// 退出登录
const handleLogout = async () => {
  isLoading.value = true;
  try {
    await authStore.logout();
  } finally {
    isLoading.value = false;
  }
};

// 跳转到设置页面
const goToSettings = () => {
  router.push("/setting");
};

onMounted(async () => {
  if (!authStore.isLoggedIn) {
    // return;
  }
  if (!authStore.user) {
    authStore.fetchUserInfo();
  }
  // 进入页面先查一次进度
  try {
    const res = await getProgress();
    // 如果 success 为 true，说明有任务在处理，显示“查看同步进度”按钮
    hasPendingProcessing.value = res.success;
  } catch (e) {
    hasPendingProcessing.value = false;
  }
});

onUnmounted(() => {
  // 退出页面，轮询应该结束
  pollingAbort.value = true;
});

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const startPolling = async () => {
  isProcessing.value = true;
  pollingAbort.value = false;
  processElapsedSec.value = 0;
  try {
    while (true) {
      const res = await getProgress();
      const {status, reason} = (res as any).data || {};
      processStatus.value = status;
      processReason.value = reason || "";

      if (pollingAbort.value) break;
      if (status !== 0) break;
      processElapsedSec.value += 1;
      await sleep(1000);
    }
  } finally {
    isProcessing.value = false;
    hasPendingProcessing.value = false;
  }
  if (processStatus.value === 1) {
    Toast.success("数据同步成功");
  } else if (processStatus.value === 2) {
    Toast.error(processReason.value || "导入失败");
  }
};

const resetSync = () => {
  isUploading.value = false;
  isProcessing.value = false;
  uploadPercent.value = 0;
  processStatus.value = null;
  processReason.value = "";
  processElapsedSec.value = 0;
  hasPendingProcessing.value = false;
};

const handleSyncClick = () => {
  fileInputRef.value?.click();
};

const onFileSelected = async (e: Event) => {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = ""; // 重置，便于重复选择同一文件
  if (!file) return;

  const ext = file.name.split(".").pop()?.toLowerCase();
  if (!ext || (ext !== "zip" && ext !== "json")) {
    Toast.warning("仅支持上传 zip 或 json 文件");
    return;
  }

  try {
    // 1) 上传阶段：显示上传进度条
    isUploading.value = true;
    const formData = new FormData();
    formData.append("file", file);

    await uploadImportData(formData, (event: ProgressEvent) => {
      if (event.total) {
        uploadPercent.value = Math.round((event.loaded / event.total) * 100);
      }
    });

    // 上传完成后，隐藏进度条
    isUploading.value = false;

    // 2) 后台处理阶段：提示可查看，并由用户点击后开始轮询
    hasPendingProcessing.value = true;
    await startPolling();
  } catch (err: any) {
    isUploading.value = false;
    isProcessing.value = false;
    Toast.error(err?.message || "上传或导入失败");
  }
};
</script>

<template>
  <div class="user-page">
    <div class="profile-card">
      <div class="profile-header">
        <div class="avatar-wrap">
          <div class="avatar ring">
            <img v-if="authStore.user?.avatar" :src="authStore.user.avatar" alt="头像"/>
            <div v-else class="avatar-placeholder">
              {{ authStore.user?.nickname?.charAt(0) || "U" }}
            </div>
          </div>
        </div>
        <div class="headline">
          <h2>{{ authStore.user?.nickname || "用户" }}</h2>
          <p v-if="authStore.user?.email">{{ authStore.user.email }}</p>
          <p v-if="authStore.user?.phone">{{ authStore.user.phone }}</p>
        </div>
      </div>

      <div class="actions">
        <BaseButton
            class="w-full"
            size="large"
            type="primary"
            :disabled="isUploading || isProcessing"
            @click="handleSyncClick"
        >
          同步数据
        </BaseButton>

        <!-- 如果进入页面检测到有后台任务，则显示查看按钮，点击后开始轮询 -->
        <BaseButton
            v-if="hasPendingProcessing && !isProcessing && !isUploading"
            class="w-full"
            size="large"
            @click="startPolling"
        >
          查看同步进度
        </BaseButton>

        <BaseButton class="w-full" size="large" @click="goToSettings">
          系统设置
        </BaseButton>

        <BaseButton
            class="w-full"
            size="large"
            type="info"
            :loading="isLoading"
            @click="handleLogout"
        >
          退出登录
        </BaseButton>
      </div>

      <input
          ref="fileInputRef"
          type="file"
          accept=".zip,.json"
          class="hidden"
          @change="onFileSelected"
      />

      <!-- 上传进度：仅在上传阶段显示 -->
      <div v-if="isUploading" class="sync-progress">
        <div class="progress-bar">
          <div class="progress-fill" :style="{ width: uploadPercent + '%' }"></div>
        </div>
        <div class="progress-text">
          <span>上传中（{{ uploadPercent }}%）</span>
        </div>
      </div>

      <!-- 后台处理提示与轮询状态展示 -->
      <div v-if="isProcessing" class="processing">
        <div class="spinner"></div>
        <div class="processing-text">
          <span>后台正在处理...</span>
          <span class="elapsed">已用时：{{ Math.floor(processElapsedSec / 60) }}分{{ processElapsedSec % 60 }}秒</span>
          <span v-if="processReason" class="hint">{{ processReason }}</span>
        </div>
      </div>

      <!-- 完成/失败提示 -->
      <div v-if="processStatus === 1" class="result success">导入完成</div>
      <div v-if="processStatus === 2" class="result fail">导入失败：{{ processReason }}</div>
    </div>
  </div>
</template>

<style scoped>
.user-page {
  max-width: 760px;
  margin: 0 auto;
  padding: 2rem 1.25rem 3rem;
}

.profile-card {
  background: #fff;
  border-radius: 18px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.06);
  overflow: hidden;
}

.profile-header {
  position: relative;
  padding: 2.25rem 2rem 1.5rem;
  background: linear-gradient(135deg, #6b73ff 0%, #000dff 100%);
  color: #fff;
  display: flex;
  align-items: center;
  gap: 1.25rem;
}

.avatar-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
}

.avatar {
  width: 88px;
  height: 88px;
  border-radius: 50%;
  overflow: hidden;
  background: #fff1;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
}

.ring {
  position: relative;
}

.ring::before {
  content: "";
  position: absolute;
  inset: -4px;
  border-radius: 50%;
  background: linear-gradient(135deg, #fff, rgba(255, 255, 255, 0.2));
  -webkit-mask: radial-gradient(circle at center, transparent 62%, #000 63%);
}

.avatar-placeholder {
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 2rem;
  font-weight: bold;
}

.headline h2 {
  margin: 0 0 0.25rem 0;
  font-size: 1.6rem;
  font-weight: 700;
}

.headline p {
  margin: 0.1rem 0;
  opacity: 0.9;
}

.actions {
  display: grid;
  grid-template-columns: 1fr;
  gap: 0.9rem;
  padding: 1.25rem;
}

.sync-progress {
  padding: 0 1.25rem 1.25rem;
}

.progress-bar {
  width: 100%;
  height: 10px;
  border-radius: 999px;
  background: #f1f2f6;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #6b73ff 0%, #00d4ff 100%);
  transition: width 0.3s ease;
}

.progress-text {
  display: flex;
  justify-content: space-between;
  margin-top: 0.5rem;
  font-size: 0.9rem;
  color: #444;
}

.reason {
  color: #d33;
}

.processing {
  padding: 0 1.25rem 1.25rem;
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.spinner {
  width: 18px;
  height: 18px;
  border: 2px solid #c7c9d3;
  border-top-color: #6b73ff;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.processing-text {
  display: flex;
  flex-direction: column;
  font-size: 0.95rem;
  color: #333;
}

.elapsed {
  margin-top: 2px;
  font-size: 0.85rem;
  color: #666;
}

.hint {
  margin-top: 2px;
  font-size: 0.85rem;
  color: #555;
}

.result {
  padding: 0 1.25rem 1.25rem;
  font-size: 0.95rem;
}

.success {
  color: #2e7d32;
}

.fail {
  color: #d33;
}

.hidden {
  display: none;
}
</style>
