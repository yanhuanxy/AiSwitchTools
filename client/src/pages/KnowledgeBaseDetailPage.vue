<template>
  <div class="h-full flex flex-col px-6 py-6">
    <!-- Header -->
    <div class="flex-shrink-0 flex items-center gap-4 mb-6">
      <button @click="router.back()" class="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-500">
        <span class="text-xl">←</span>
      </button>
      <div class="flex-1">
        <h1 class="text-2xl font-bold text-gray-900">{{ kb?.name || '加载中...' }}</h1>
        <p class="text-sm text-gray-500 mt-1">{{ kb?.description || '暂无描述' }}</p>
      </div>
      <div class="flex items-center gap-3">
        <input 
            type="file" 
            ref="fileInput" 
            class="hidden" 
            accept=".pdf,.docx,.txt,.md"
            @change="handleFileUpload"
        >
        <CButton @click="triggerUpload" :disabled="uploading">
            {{ uploading ? '上传中...' : '上传文档' }}
        </CButton>
      </div>
    </div>

    <!-- Document List -->
    <div class="flex-1 bg-white rounded-xl border border-gray-200 overflow-hidden flex flex-col shadow-sm">
        <div class="overflow-y-auto flex-1 p-0">
            <table class="w-full text-left border-collapse">
                <thead class="bg-gray-50 sticky top-0 z-10">
                    <tr class="text-gray-500 text-xs uppercase tracking-wider border-b border-gray-200">
                        <th class="py-3 px-6 font-medium">文档名称</th>
                        <th class="py-3 px-6 font-medium w-32">大小</th>
                        <th class="py-3 px-6 font-medium w-32">状态</th>
                        <th class="py-3 px-6 font-medium w-48">上传时间</th>
                        <th class="py-3 px-6 font-medium w-24 text-right">操作</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-gray-100">
                    <tr v-if="loading" v-for="n in 3" :key="n">
                        <td class="py-4 px-6"><div class="h-4 bg-gray-100 rounded w-1/2 animate-pulse"></div></td>
                        <td class="py-4 px-6"><div class="h-4 bg-gray-100 rounded w-16 animate-pulse"></div></td>
                        <td class="py-4 px-6"><div class="h-4 bg-gray-100 rounded w-16 animate-pulse"></div></td>
                        <td class="py-4 px-6"><div class="h-4 bg-gray-100 rounded w-24 animate-pulse"></div></td>
                        <td class="py-4 px-6"></td>
                    </tr>
                    <tr v-else-if="documents.length === 0">
                        <td colspan="5" class="py-20 text-center">
                           <div class="flex flex-col items-center justify-center text-gray-400">
                             <span class="text-4xl mb-2">📄</span>
                             <span>暂无文档，请点击右上角上传</span>
                           </div>
                        </td>
                    </tr>
                    <tr v-else v-for="doc in documents" :key="doc.id" class="group hover:bg-gray-50 transition-colors">
                        <td class="py-3 px-6">
                            <div class="flex items-center gap-3">
                                <span class="text-xl opacity-70">{{ getIcon(doc.mimeType) }}</span>
                                <span class="text-gray-900 font-medium text-sm">{{ doc.name }}</span>
                            </div>
                        </td>
                        <td class="py-3 px-6 text-sm text-gray-500">{{ formatSize(doc.size) }}</td>
                        <td class="py-3 px-6">
                            <span :class="getStatusClass(doc.status)" class="px-2 py-0.5 rounded text-xs font-medium inline-block min-w-[60px] text-center">
                                {{ getStatusLabel(doc.status) }}
                            </span>
                        </td>
                        <td class="py-3 px-6 text-sm text-gray-500">{{ formatDate(doc.createdAt) }}</td>
                        <td class="py-3 px-6 text-right">
                             <button 
                                 class="p-1.5 hover:bg-red-50 rounded text-gray-400 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                                 title="删除"
                                 @click="removeDoc(doc.id)"
                               >
                                 🗑️
                               </button>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { api } from '../services/api'
import { handleError } from '../services/error'
import CButton from '../components/common/CButton.vue'

const route = useRoute()
const router = useRouter()
const kbId = route.params.id as string

const kb = ref<any>(null)
const documents = ref<any[]>([])
const loading = ref(false)
const uploading = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)

const load = async () => {
    loading.value = true
    try {
        const res = await api.get(`/knowledge-bases/${kbId}`)
        kb.value = res.data
        documents.value = res.data.documents || []
    } catch (err) {
        handleError(err, '加载知识库详情失败')
        router.push('/knowledge-bases')
    } finally {
        loading.value = false
    }
}

const triggerUpload = () => {
    fileInput.value?.click()
}

const handleFileUpload = async (event: Event) => {
    const files = (event.target as HTMLInputElement).files
    if (!files || files.length === 0) return

    const file = files[0]
    const formData = new FormData()
    formData.append('file', file)

    uploading.value = true
    try {
        await api.post(`/knowledge-bases/${kbId}/documents`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        })
        await load() // Reload list
    } catch (err) {
        handleError(err, '上传文档失败')
    } finally {
        uploading.value = false
        if (fileInput.value) fileInput.value.value = ''
    }
}

const removeDoc = async (docId: string) => {
    if (!confirm('确认删除该文档？')) return
    try {
        await api.delete(`/knowledge-bases/${kbId}/documents/${docId}`)
        await load()
    } catch (err) {
        handleError(err, '删除文档失败')
    }
}

const getIcon = (mime: string) => {
    if (!mime) return '📄'
    if (mime.includes('pdf')) return '📕'
    if (mime.includes('word') || mime.includes('document')) return '📘'
    if (mime.includes('image')) return '🖼️'
    return '📄'
}

const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

const formatDate = (str: string) => new Date(str).toLocaleString()

const getStatusLabel = (status: string) => {
    const map: any = { processing: '处理中', indexed: '已索引', failed: '失败' }
    return map[status] || status
}

const getStatusClass = (status: string) => {
    if (status === 'indexed') return 'bg-green-100 text-green-700'
    if (status === 'failed') return 'bg-red-100 text-red-700'
    return 'bg-blue-100 text-blue-700'
}

onMounted(load)
</script>
