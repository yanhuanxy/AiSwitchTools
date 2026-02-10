<template>
  <div class="border-t border-gray-border bg-white p-4">
    <div class="relative bg-white border border-gray-border rounded-xl shadow-sm hover:border-primary focus-within:border-primary focus-within:ring-1 focus-within:ring-primary transition-all duration-200">
      <textarea
        v-model="content"
        rows="3"
        class="w-full resize-none bg-transparent border-none outline-none p-3 text-sm text-gray-900 placeholder-gray-400"
        placeholder="发送消息..."
        @keydown.enter.prevent="handleEnter"
      ></textarea>
      
      <div class="flex justify-between items-center px-2 pb-2">
        <div class="flex items-center gap-1 text-gray-400">
          <!-- Placeholder for attachment icons -->
          <button class="p-1.5 hover:bg-gray-100 rounded text-gray-500 transition-colors" title="上传图片">
             📎
          </button>
        </div>
        <div class="flex items-center gap-2">
          <slot name="actions"></slot>
          
          <!-- Stop Button -->
          <button
            v-if="sending && canStop"
            @click="$emit('stop')"
            class="bg-red-50 text-red-500 border border-red-200 rounded-lg w-8 h-8 flex items-center justify-center hover:bg-red-100 transition-colors"
            title="停止生成"
          >
            <span class="font-bold text-xs">■</span>
          </button>

          <!-- Send Button -->
          <button
            v-else
            @click="submit"
            :disabled="sending || !content.trim()"
            class="bg-primary text-white rounded-lg w-8 h-8 flex items-center justify-center hover:bg-primary-hover active:bg-primary-active disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <span v-if="sending" class="animate-spin text-xs">↻</span>
            <span v-else>➤</span>
          </button>
        </div>
      </div>
    </div>
    <div class="text-xs text-center text-gray-400 mt-2">
      内容由 AI 生成，请仔细甄别
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue"

const emit = defineEmits<{ 
  (e: "send", value: string): void 
  (e: "stop"): void 
}>()
const props = defineProps<{ 
  sending?: boolean 
  canStop?: boolean
}>()
const content = ref("")

const submit = () => {
  const value = content.value.trim()
  if (!value || props.sending) return
  emit("send", value)
  content.value = ""
}

const handleEnter = (e: KeyboardEvent) => {
  if (!e.shiftKey) {
    submit()
  }
}
</script>
