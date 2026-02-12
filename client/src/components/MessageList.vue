<template>
  <div class="space-y-6">
    <MessageItem v-for="item in messages" :key="item.id" :message="item" :show-debug-logs="showDebugLogs" />
  </div>
</template>

<script setup lang="ts">
import MessageItem from "./MessageItem.vue"
import type { Message } from "../types"

defineProps<{ messages: Message[], showDebugLogs?: boolean }>()
</script>
