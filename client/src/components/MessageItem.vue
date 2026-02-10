<template>
  <div class="flex gap-4 group" :class="{ 'flex-row-reverse': isUser }">
    <!-- Avatar -->
    <div class="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-sm font-bold"
         :class="isUser ? 'bg-primary text-white' : 'bg-white border border-gray-200 text-primary'">
      {{ isUser ? 'U' : 'C' }}
    </div>

    <!-- Message Bubble -->
    <div class="max-w-[80%] space-y-2">
      <div class="flex items-baseline gap-2" :class="{ 'flex-row-reverse': isUser }">
         <span class="text-sm font-medium text-gray-900">{{ isUser ? '我' : 'Tools 智能体' }}</span>
         <span class="text-xs text-gray-400 hidden group-hover:block">{{ formatTime(message.createdAt) }}</span>
      </div>

      <div class="relative px-4 py-3 rounded-lg text-sm leading-relaxed shadow-sm border"
        :class="isUser 
          ? 'bg-primary-light border-primary-light text-gray-900 rounded-tr-none' 
          : 'bg-white border-gray-100 text-gray-900 rounded-tl-none'">
        
        <!-- Attachments -->
        <div v-if="message.attachments && message.attachments.length" class="flex flex-wrap gap-2 mb-2">
           <el-image
            v-for="img in message.attachments"
            :key="img.attachmentId"
            :src="img.viewUrl"
            :preview-src-list="[img.viewUrl!]"
            fit="cover"
            class="w-24 h-24 rounded-lg border border-gray-100"
          />
        </div>

        <!-- Text Content -->
        <div class="whitespace-pre-wrap break-words">{{ message.content }}</div>
        
        <!-- Status Indicators -->
        <div v-if="message.status === 'generating'" class="mt-2 flex items-center gap-1 text-xs text-primary">
           <span class="animate-spin">⏳</span> 生成中...
        </div>
        <div v-else-if="message.status === 'failed'" class="mt-2 text-xs text-danger">
           ⚠️ 生成失败
        </div>
      </div>
      
      <!-- Actions (Copy, Regenerate, etc.) -->
      <div class="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity" :class="{ 'justify-end': isUser }">
         <button 
           class="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-600 transition-colors" 
           title="复制"
           @click="copyContent"
         >
           <span v-if="copied">✓</span>
           <span v-else>📄</span>
         </button>
         <button v-if="!isUser" class="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-600" title="赞">
           👍
         </button>
         <button v-if="!isUser" class="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-600" title="踩">
           👎
         </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Message } from "../types"
import { computed, ref } from "vue"
import { ElMessage } from "element-plus"

const props = defineProps<{ message: Message }>()
const isUser = computed(() => props.message.role === "user")
const copied = ref(false)

const formatTime = (iso: string) => {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

const copyContent = async () => {
  try {
    await navigator.clipboard.writeText(props.message.content)
    copied.value = true
    ElMessage.success("已复制到剪贴板")
    setTimeout(() => {
      copied.value = false
    }, 2000)
  } catch (err) {
    console.error('Failed to copy:', err)
    ElMessage.error("复制失败")
  }
}
</script>
