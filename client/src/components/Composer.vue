<template>
  <el-card class="stack">
    <el-input v-model="content" type="textarea" :rows="3" placeholder="输入消息" />
    <div class="row">
      <el-button type="primary" :disabled="sending" @click="submit">发送</el-button>
      <slot name="actions"></slot>
    </div>
  </el-card>
</template>

<script setup lang="ts">
import { ref } from "vue"

const emit = defineEmits<{ (e: "send", value: string): void }>()
const props = defineProps<{ sending?: boolean }>()
const content = ref("")

const submit = () => {
  const value = content.value.trim()
  if (!value) return
  emit("send", value)
  content.value = ""
}
</script>
