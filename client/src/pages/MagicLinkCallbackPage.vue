<template>
  <div class="stack">
    <el-card class="stack">
      <template #header>
        <strong>账号绑定</strong>
      </template>
      <div v-if="loading" class="stack">
        <el-skeleton :rows="3" animated />
        <div class="muted" style="text-align: center">正在绑定，请稍候...</div>
      </div>
      <el-result
        v-else-if="errorMessage"
        icon="error"
        title="绑定失败"
        :sub-title="errorMessage"
      >
        <template #extra>
          <el-button type="primary" @click="goHome">返回角色页</el-button>
        </template>
      </el-result>
      <el-result v-else icon="success" title="绑定成功" sub-title="您现在可以访问您的账号数据了">
        <template #extra>
          <el-button type="primary" @click="goHome">返回角色页</el-button>
        </template>
      </el-result>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue"
import { useRoute, useRouter } from "vue-router"
import { useAuthStore } from "../stores/auth"
import { getErrorMessage } from "../services/error"

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const loading = ref(true)
const errorMessage = ref("")

const goHome = () => {
  router.replace("/roles")
}

onMounted(async () => {
  const token = route.query.token as string | undefined
  if (!token) {
    errorMessage.value = "缺少绑定令牌"
    loading.value = false
    return
  }
  try {
    await authStore.bindWithMagicToken(token)
  } catch (error: any) {
    const code = error?.response?.data?.code
    errorMessage.value = getErrorMessage(code, error?.message)
  } finally {
    loading.value = false
  }
})
</script>
