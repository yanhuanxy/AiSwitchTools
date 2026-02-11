<template>
  <div 
    class="border-t border-gray-border bg-white p-4 transition-colors duration-200"
    :class="{ 'bg-[#F5F7FA]': isDragging }"
    @dragover.prevent="handleDragOver"
    @dragleave.prevent="handleDragLeave"
    @drop.prevent="handleDrop"
  >
    <div 
      class="relative bg-white border rounded-xl shadow-sm transition-all duration-200 flex flex-col"
      :class="[
        isDragging ? 'border-dashed border-primary border-2' : 'border-gray-border hover:border-primary focus-within:border-primary focus-within:ring-1 focus-within:ring-primary'
      ]"
    >
      <!-- Image Uploader (Thumbnails) -->
      <div class="px-3 pt-3">
        <ChatImageUploader 
          ref="uploaderRef" 
          @update:files="handleFilesUpdate" 
        />
      </div>

      <textarea
        v-model="content"
        rows="3"
        class="w-full resize-none bg-transparent border-none outline-none p-3 text-sm text-gray-900 placeholder-gray-400"
        placeholder="发送消息..."
        @keydown.enter.prevent="handleEnter"
      ></textarea>
      
      <div class="flex justify-between items-center px-2 pb-2">
        <div class="flex items-center gap-1 text-gray-400">
          <button 
            class="p-1.5 hover:bg-gray-100 rounded text-gray-500 transition-colors" 
            title="上传图片"
            @click="triggerUpload"
          >
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
            :disabled="sending || (!content.trim() && uploadedFiles.length === 0)"
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
import { ref, computed } from "vue"
import ChatImageUploader from "./ChatImageUploader/index.vue"
import type { UploadFile } from "../types/upload"

const emit = defineEmits<{ 
  (e: "send", value: string, attachmentIds: string[]): void 
  (e: "stop"): void 
}>()

const props = defineProps<{ 
  sending?: boolean 
  canStop?: boolean
}>()

const content = ref("")
const isDragging = ref(false)
const uploaderRef = ref<InstanceType<typeof ChatImageUploader> | null>(null)
const files = ref<UploadFile[]>([])

const uploadedFiles = computed(() => 
  files.value.filter(f => f.status === 'success' && f.id)
)

const handleFilesUpdate = (updatedFiles: UploadFile[]) => {
  files.value = updatedFiles
}

const triggerUpload = () => {
  uploaderRef.value?.triggerUpload()
}

const handleDragOver = (e: DragEvent) => {
  isDragging.value = true
}

const handleDragLeave = (e: DragEvent) => {
  // Check if leaving the main container
  if (e.currentTarget === e.target) {
    isDragging.value = false
  }
}

const handleDrop = (e: DragEvent) => {
  isDragging.value = false
  const droppedFiles = Array.from(e.dataTransfer?.files || [])
  if (droppedFiles.length > 0) {
    uploaderRef.value?.addFiles(droppedFiles)
  }
}

const submit = () => {
  const value = content.value.trim()
  const attachmentIds = uploadedFiles.value.map(f => f.attachmentId).filter(Boolean) as string[]
  
  if ((!value && attachmentIds.length === 0) || props.sending) return
  
  emit("send", value, attachmentIds)
  
  // Clear content
  content.value = ""
  // Clear uploader files (assuming they are sent)
  // Or should we keep them if send fails? 
  // Parent handles failure. Ideally we clear only on success, but `emit` is fire-and-forget here.
  // We'll clear them for now to mimic standard chat behavior.
  if (uploaderRef.value) {
    uploaderRef.value.files = []
    files.value = []
  }
}

const handleEnter = (e: KeyboardEvent) => {
  if (!e.shiftKey) {
    submit()
  }
}
</script>
