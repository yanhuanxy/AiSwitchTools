<template>
  <div class="stack">
    <el-card class="stack">
      <template #header>
        <strong>绑定账号</strong>
      </template>
      <div class="muted" style="margin-bottom: 12px">当前身份：{{ identityLabel }}</div>
      <el-form @submit.prevent="submit">
        <el-form-item>
          <el-input v-model="email" placeholder="请输入邮箱地址" />
        </el-form-item>
        <el-form-item>
          <div class="row">
            <el-button type="primary" :loading="sending" @click="submit">发送绑定链接</el-button>
            <el-button :disabled="sending" @click="reset">重置</el-button>
          </div>
        </el-form-item>
      </el-form>
      <el-alert
        v-if="sent"
        title="已发送，请查收邮箱完成绑定"
        type="success"
        show-icon
        :closable="false"
      />
      <el-alert
        v-if="errorMessage"
        :title="errorMessage"
        type="error"
        show-icon
        :closable="false"
      />
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue"
import { useAuthStore } from "../stores/auth"
import { startMagicLink } from "../services/auth"
import { getErrorMessage, notifyError } from "../services/error"

const authStore = useAuthStore()
const email = ref("")
const sending = ref(false)
const sent = ref(false)
const errorMessage = ref("")

const identityLabel = computed(() => {
  if (authStore.identityType) return authStore.identityType
  return "匿名"
})

const submit = async () => {
  if (!email.value.trim()) {
    notifyError("请输入邮箱地址")
    return
  }
  sending.value = true
  errorMessage.value = ""
  try {
    await startMagicLink(email.value.trim())
    sent.value = true
  } catch (error: any) {
    const code = error?.response?.data?.code
    errorMessage.value = getErrorMessage(code, error?.message)
  } finally {
    sending.value = false
  }
}

const reset = () => {
  email.value = ""
  sent.value = false
  errorMessage.value = ""
}
</script>
