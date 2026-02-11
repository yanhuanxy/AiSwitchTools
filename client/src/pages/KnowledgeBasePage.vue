<template>
  <div class="h-full flex flex-col px-6 py-6">
    <!-- Header Area -->
    <div class="flex-shrink-0 flex flex-col gap-4 mb-6">
      <!-- Top Bar: Title -->
      <div class="flex items-center justify-between">
        <h1 class="text-2xl font-bold text-gray-900 tracking-tight">知识库</h1>
      </div>

      <!-- Toolbar: Tabs (Left) + Search/Actions (Right) -->
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <!-- Tabs -->
        <div class="flex items-center gap-1 bg-gray-100 p-1 rounded-lg self-start">
          <button 
            v-for="tab in tabs" 
            :key="tab.value"
            @click="currentTab = tab.value"
            class="px-4 py-1.5 text-sm font-medium rounded-md transition-all duration-200"
            :class="currentTab === tab.value 
              ? 'bg-white text-gray-900 shadow-sm' 
              : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200/50'"
          >
            {{ tab.label }}
          </button>
        </div>

        <!-- Right Actions -->
        <div class="flex items-center gap-3 w-full md:w-auto">
          <!-- Search Bar -->
          <div class="relative flex-1 md:w-64 group">
            <input 
              v-model="searchQuery"
              type="text" 
              placeholder="搜索知识库" 
              class="w-full h-9 pl-9 pr-3 rounded-lg border border-gray-200 bg-white text-sm placeholder-gray-400 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all group-hover:border-gray-300"
            >
            <span class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">🔍</span>
          </div>
          
          <!-- Create Button -->
          <CButton @click="createKB" class="whitespace-nowrap shadow-sm hover:shadow-md transition-shadow">
            <span class="text-lg leading-none mr-1 font-light">+</span> 新建知识库
          </CButton>
        </div>
      </div>
    </div>

    <!-- Content -->
    <div v-if="loading" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      <div v-for="n in 4" :key="n" class="h-32 bg-gray-50 rounded-xl animate-pulse"></div>
    </div>

    <div v-else-if="filteredItems.length === 0" class="flex-1 flex items-center justify-center bg-white rounded-xl border border-gray-100 border-dashed">
      <div class="text-center py-16 flex flex-col items-center">
        <div class="w-16 h-16 bg-orange-50 rounded-full flex items-center justify-center mb-4 text-2xl text-orange-500">📚</div>
        <div class="text-gray-900 font-medium mb-1">暂无知识库</div>
        <div class="text-gray-400 text-sm mb-6">创建一个知识库来存储和检索你的文档</div>
        <CButton @click="createKB">立即创建</CButton>
      </div>
    </div>

    <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pb-8">
      <!-- KB Card (Horizontal Style matching RoleCard) -->
      <div 
        v-for="item in filteredItems" 
        :key="item.id" 
        class="bg-white border border-gray-200 rounded-xl p-4 flex gap-4 hover:shadow-md hover:border-orange-200 transition-all duration-200 cursor-pointer group h-full"
        @click="detail(item.id)"
      >
        <!-- Icon (Left) -->
        <div class="flex-shrink-0">
          <div class="w-14 h-14 rounded-xl bg-orange-50 flex items-center justify-center text-2xl text-orange-500 group-hover:bg-orange-500 group-hover:text-white transition-colors">
            📚
          </div>
        </div>

        <!-- Content (Right) -->
        <div class="flex flex-col flex-1 min-w-0 h-full">
          <!-- Header -->
          <div class="flex justify-between items-start mb-1">
            <h3 class="font-bold text-gray-900 text-base truncate pr-2 group-hover:text-orange-500 transition-colors">
              {{ item.name }}
            </h3>
            <!-- Doc Count Badge -->
            <span class="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded flex-shrink-0">{{ item.documents?.length || 0 }} 文档</span>
          </div>

          <!-- Description -->
          <p class="text-xs text-gray-500 line-clamp-2 mb-3 flex-1 h-8 leading-relaxed">
            {{ item.description || "暂无描述信息..." }}
          </p>

          <!-- Footer -->
          <div class="flex items-center justify-between mt-auto pt-2 border-t border-gray-50">
            <div class="flex items-center gap-2 text-xs text-gray-400">
              <span class="bg-gray-50 px-1.5 py-0.5 rounded">私有</span>
              <span>{{ formatDate(item.createdAt) }}</span>
            </div>
            
            <!-- Actions (Visible on Hover) -->
            <div class="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
               <button 
                 class="p-1.5 hover:bg-gray-100 rounded text-gray-400 hover:text-orange-500 transition-colors"
                 title="管理"
                 @click.stop="detail(item.id)"
               >
                 ⚙️
               </button>
               <button 
                 class="p-1.5 hover:bg-gray-100 rounded text-gray-400 hover:text-danger transition-colors"
                 title="删除"
                 @click.stop="remove(item.id)"
               >
                 🗑️
               </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Create KB Modal -->
    <CModal 
      v-model="showCreateModal" 
      title="新建知识库"
    >
      <div class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">
            知识库名称 <span class="text-red-500">*</span>
          </label>
          <input 
            v-model="createForm.name"
            type="text" 
            class="coze-input w-full" 
            placeholder="请输入知识库名称"
            @keyup.enter="submitCreate"
            ref="nameInput"
          >
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">
            描述
          </label>
          <textarea 
            v-model="createForm.description"
            rows="3"
            class="coze-input w-full h-auto py-2 resize-none" 
            placeholder="请输入知识库描述（选填）"
          ></textarea>
        </div>
      </div>

      <template #footer>
        <CButton variant="secondary" @click="showCreateModal = false">取消</CButton>
        <CButton @click="submitCreate" :disabled="isCreating || !createForm.name.trim()">
          {{ isCreating ? '创建中...' : '确认创建' }}
        </CButton>
      </template>
    </CModal>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { handleError } from '../services/error'
import { api } from '../services/api'
import CModal from '../components/common/CModal.vue'
import CButton from '../components/common/CButton.vue'

const router = useRouter()
const items = ref<any[]>([])
const loading = ref(false)
const searchQuery = ref('')
const currentTab = ref('all')

// Create Modal State
const showCreateModal = ref(false)
const isCreating = ref(false)
const createForm = ref({ name: '', description: '' })
const nameInput = ref<HTMLInputElement | null>(null)

const tabs = [
  { label: '全部', value: 'all' },
  { label: '我的收藏', value: 'favorites' }
]

const filteredItems = computed(() => {
  let result = items.value
  
  // Tab Filter (Mock favorites)
  if (currentTab.value === 'favorites') {
    // result = result.filter(item => item.isFavorite)
    // For demo, just return empty or some items
    result = []
  }

  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    result = result.filter(item => 
      item.name.toLowerCase().includes(query) || 
      (item.description && item.description.toLowerCase().includes(query))
    )
  }
  return result
})

const formatDate = (dateStr?: string) => {
  if (!dateStr) return '刚刚'
  return new Date(dateStr).toLocaleDateString()
}
const load = async () => {
  loading.value = true
  try {
    const res = await api.get('/knowledge-bases')
    items.value = res.data
  } catch (err: any) {
    handleError(err, '加载知识库失败', 'kb.list')
  } finally {
    loading.value = false
  }
}

const createKB = () => {
  createForm.value = { name: '', description: '' }
  showCreateModal.value = true
  // Focus logic would need nextTick but keeping it simple for now or adding import
}

const submitCreate = async () => {
  if (!createForm.value.name.trim()) return
  
  isCreating.value = true
  try {
    await api.post('/knowledge-bases', {
      name: createForm.value.name,
      description: createForm.value.description
    })
    showCreateModal.value = false
    await load()
  } catch (err: any) {
    handleError(err, '创建失败', 'kb.create')
  } finally {
    isCreating.value = false
  }
}

const detail = (id: string) => {
  router.push(`/knowledge-bases/${id}`)
}

const remove = async (id: string) => {
  if (!window.confirm('确认删除？')) return
  try {
    await api.delete(`/knowledge-bases/${id}`)
    await load()
  } catch (err: any) {
    handleError(err, '删除失败', 'kb.delete')
  }
}

onMounted(load)
</script>
