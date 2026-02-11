<template>
  <div class="chat-image-uploader">
    <!-- Image Preview List -->
    <div v-if="files.length > 0" class="flex flex-wrap gap-2 mb-2">
      <div
        v-for="file in files"
        :key="file.id"
        class="relative group w-20 h-20 rounded-lg border border-gray-200 bg-gray-50 overflow-hidden"
      >
        <!-- Thumbnail -->
        <img
          :src="file.url || file.previewUrl"
          class="w-full h-full object-cover cursor-pointer"
          :class="{ 'opacity-50': file.status === 'error' || file.status === 'uploading' }"
          @click="handlePreview(file)"
          alt="thumbnail"
        />

        <!-- Progress Bar -->
        <div
          v-if="file.status === 'uploading'"
          class="absolute bottom-0 left-0 h-0.5 bg-primary transition-all duration-200"
          :style="{ width: `${file.progress}%` }"
        ></div>

        <!-- Remove Button (Top Right) -->
        <button
          class="absolute top-0.5 right-0.5 p-0.5 bg-black/50 hover:bg-black/70 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity"
          @click.stop="removeFile(file.id)"
          :aria-label="$t('remove_image')"
        >
          <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 6L6 18M6 6l12 12" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>

        <!-- Retry Button (Center) -->
        <button
          v-if="file.status === 'error'"
          class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 p-1.5 bg-white/90 rounded-full text-danger shadow-sm hover:bg-white transition-colors"
          @click.stop="retryUpload(file.id)"
          :aria-label="$t('upload_error_retry')"
        >
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M23 4v6h-6M1 20v-6h6" />
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
          </svg>
        </button>
      </div>
    </div>

    <!-- Hidden Input -->
    <input
      ref="fileInputRef"
      type="file"
      accept="image/png,image/jpeg,image/gif,image/webp"
      multiple
      class="hidden"
      @change="handleFileSelect"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, onUnmounted, computed } from "vue"
import { ElMessage, ElMessageBox } from "element-plus"
import { apiClient } from "../../services/api"
import type { UploadFile } from "../../types/upload"

// Define props/emits if needed, or expose methods
const emit = defineEmits<{
  (e: 'update:files', files: UploadFile[]): void
}>()

const files = ref<any[]>([])
const fileInputRef = ref<HTMLInputElement | null>(null)
const uploadQueue = ref<string[]>([])
const activeUploads = ref(0)
const MAX_CONCURRENT = 3
const MAX_SIZE = 10 * 1024 * 1024 // 10MB

// Helper for i18n (mocking since no full i18n setup detected in previous context, but will try to use if available or fallback)
const $t = (key: string) => {
  const map: Record<string, string> = {
    upload_image_label: "上传图片",
    upload_progress: "上传中",
    upload_error_retry: "上传失败，点击重试",
    remove_image: "删除图片",
    image_too_large: "图片大小不能超过 10 MB",
    network_error: "网络异常，请检查连接后重试",
    server_error_413: "图片过大，请压缩后重新上传",
    only_image: "仅支持图片格式",
    wait_for_upload: "请等待上传完成"
  }
  return map[key] || key
}

const triggerUpload = () => {
  const pendingCount = files.value.filter(f => f.status === 'pending' || f.status === 'uploading').length
  if (pendingCount >= 5) {
    ElMessage.warning($t('wait_for_upload'))
    return
  }
  fileInputRef.value?.click()
}

const handleFileSelect = (e: Event) => {
  const target = e.target as HTMLInputElement
  if (target.files) {
    addFiles(Array.from(target.files))
  }
  target.value = '' // Reset
}

const addFiles = (fileList: File[]) => {
  const newFiles = fileList.filter(file => {
    // MIME check
    if (!['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(file.type)) {
      ElMessage.warning($t('only_image'))
      return false
    }
    // Size check
    if (file.size > MAX_SIZE) {
      ElMessage.warning($t('image_too_large'))
      return false
    }
    return true
  })

  newFiles.forEach(file => {
    const id = Date.now().toString() + Math.random().toString(36).slice(2)
    const reader = new FileReader()
    reader.onload = (e) => {
      const uploadFile: any = {
        id,
        file,
        status: 'pending',
        progress: 0,
        previewUrl: e.target?.result as string,
        url: ''
      }
      files.value.push(uploadFile)
      enqueue(id)
    }
    reader.readAsDataURL(file)
  })
}

const enqueue = (id: string) => {
  uploadQueue.value.push(id)
  processQueue()
}

const processQueue = () => {
  if (activeUploads.value >= MAX_CONCURRENT || uploadQueue.value.length === 0) return

  const id = uploadQueue.value.shift()
  if (!id) return

  const fileIndex = files.value.findIndex(f => f.id === id)
  if (fileIndex === -1) return // Removed

  const fileItem = files.value[fileIndex]
  if (fileItem.status !== 'pending' && fileItem.status !== 'error') return

  uploadFile(fileItem)
}

const uploadFile = async (item: any) => {
  activeUploads.value++
  item.status = 'uploading'
  item.progress = 0

  const formData = new FormData()
  if (item.file) {
    formData.append('file', item.file)
  }

  try {
    const res = await apiClient.post('/uploads/images', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (progressEvent) => {
        if (progressEvent.total) {
          const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total)
          item.progress = percent
        }
      },
      timeout: 30000
    })
    
    // Adapt response: backend returns { items: [...] } or { ...item, traceId }?
    // Based on Controller: return { ...result, traceId }. result is { items: [...] }.
    // So res.data.items[0] is the attachment.
    const data = res.data
    const attachment = data.items?.[0] || data
    
    if (attachment) {
      item.status = 'success'
      item.url = attachment.viewUrl || item.previewUrl // Fallback if viewUrl null
      item.attachmentId = attachment.attachmentId // Store ID for backend binding
      item.width = attachment.width
      item.height = attachment.height
      item.size = attachment.size
      // Emit update
      emit('update:files', files.value)
    } else {
      throw new Error('Invalid response')
    }
  } catch (error: any) {
    item.status = 'error'
    item.error = error
    console.error('Upload failed', error)
    
    if (error.code === 'ERR_NETWORK') {
      ElMessageBox.alert($t('network_error'), 'Error', { confirmButtonText: 'OK' })
    } else if (error.response?.status === 413) {
      ElMessageBox.alert($t('server_error_413'), 'Error', { confirmButtonText: 'OK' })
    } else if (error.response?.status === 401) {
       // Global interceptor handles this, but we mark as error to allow retry
    }
  } finally {
    activeUploads.value--
    processQueue()
  }
}

const retryUpload = (id: string) => {
  const file = files.value.find(f => f.id === id)
  if (file) {
    enqueue(id)
  }
}

const removeFile = (id: string) => {
  const index = files.value.findIndex(f => f.id === id)
  if (index !== -1) {
    files.value.splice(index, 1)
    // Also remove from queue if present
    const qIndex = uploadQueue.value.indexOf(id)
    if (qIndex !== -1) uploadQueue.value.splice(qIndex, 1)
    emit('update:files', files.value)
  }
}

const handlePreview = (file: any) => {
  if (file.url || file.previewUrl) {
    // Simple preview (could be improved with ElImageViewer or similar)
    window.open(file.url || file.previewUrl, '_blank')
  }
}

// Expose methods for parent
defineExpose({
  triggerUpload,
  addFiles,
  files
})

// Global Paste Listener
const handlePaste = (e: ClipboardEvent) => {
  const items = e.clipboardData?.items
  if (items) {
    const fileList: File[] = []
    let hasNonImage = false
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        const file = items[i].getAsFile()
        if (file) fileList.push(file)
      } else if (items[i].kind === 'file') {
        hasNonImage = true
      }
    }
    if (fileList.length > 0) {
      addFiles(fileList)
    } else if (hasNonImage) {
      ElMessage.warning($t('only_image'))
    }
  }
}

onMounted(() => {
  document.addEventListener('paste', handlePaste)
})

onUnmounted(() => {
  document.removeEventListener('paste', handlePaste)
})
</script>

<style scoped>
/* Scoped styles if needed, mostly Tailwind used */
</style>
