<template>
  <el-card class="stack">
    <div class="row">
      <el-tag size="small">{{ roleLabel }}</el-tag>
      <span class="muted">{{ message.createdAt }}</span>
      <el-tag v-if="message.status === 'generating'" type="warning" size="small">生成中</el-tag>
      <el-tag v-else-if="message.status === 'failed'" type="danger" size="small">生成失败</el-tag>
      <el-tag v-else-if="message.status === 'canceled'" type="info" size="small">已取消</el-tag>
      <el-tag v-if="message.partial" type="warning" size="small">已停止生成</el-tag>
    </div>
    <div v-if="message.attachments && message.attachments.length" class="row">
      <el-image
        v-for="img in message.attachments"
        :key="img.attachmentId"
        :src="img.viewUrl"
        :preview-src-list="[img.viewUrl!]"
        fit="cover"
        style="width: 100px; height: 100px; border-radius: 4px"
      />
    </div>
    <div>{{ message.content }}</div>
    <el-tag v-if="message.supersededByMessageId" type="info" size="small">已被替代</el-tag>
  </el-card>
</template>

<script setup lang="ts">
import type { Message } from "../types"
import { computed } from "vue"

const props = defineProps<{ message: Message }>()
const roleLabel = computed(() => (props.message.role === "user" ? "用户" : "助手"))
</script>
