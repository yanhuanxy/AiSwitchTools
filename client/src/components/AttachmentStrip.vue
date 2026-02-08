<template>
  <el-card class="stack" v-if="files.length > 0 || showUpload">
    <div class="row">
      <el-upload
        action="#"
        :auto-upload="false"
        :on-change="handleFileChange"
        :show-file-list="false"
        multiple
        accept="image/*"
      >
        <el-button>选择图片</el-button>
      </el-upload>
      <el-button v-if="files.length > 0" @click="removeAll">清空</el-button>
    </div>
    <div class="list" v-if="files.length > 0">
      <el-tag
        v-for="(item, index) in files"
        :key="item.name + index"
        closable
        @close="removeFile(index)"
      >
        {{ item.name }} ({{ formatSize(item.size) }})
      </el-tag>
    </div>
  </el-card>
  <div v-else class="row" style="padding: 0 16px">
    <el-upload
      action="#"
      :auto-upload="false"
      :on-change="handleFileChange"
      :show-file-list="false"
      multiple
      accept="image/*"
    >
      <el-button link>上传附件</el-button>
    </el-upload>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue"
import { notifyError } from "../services/error"
import type { UploadFile } from "element-plus"

const emit = defineEmits<{ (e: "select", value: File[]): void }>()
const files = ref<File[]>([])

const showUpload = computed(() => files.value.length > 0)

const handleFileChange = (uploadFile: UploadFile) => {
  if (!uploadFile.raw) return
  const file = uploadFile.raw
  if (file.size > 10 * 1024 * 1024) {
    notifyError("单张图片不能超过 10MB")
    return
  }
  if (files.value.length >= 4) {
    notifyError("单次最多上传 4 张")
    return
  }
  files.value.push(file)
  emit("select", files.value)
}

const removeFile = (index: number) => {
  files.value.splice(index, 1)
  emit("select", files.value)
}

const removeAll = () => {
  files.value = []
  emit("select", [])
}

const formatSize = (size: number) => {
  if (size < 1024) return `${size}B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)}KB`
  return `${(size / (1024 * 1024)).toFixed(1)}MB`
}
</script>
