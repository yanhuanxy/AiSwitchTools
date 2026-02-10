<template>
  <div class="h-full flex flex-col px-6 py-6">
    <!-- Header Area -->
    <div class="flex-shrink-0 flex flex-col gap-4 mb-6">
      <!-- Top Bar: Title -->
      <div class="flex items-center justify-between">
        <h1 class="text-2xl font-bold text-gray-900 tracking-tight">工作流</h1>
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
              placeholder="搜索工作流" 
              class="w-full h-9 pl-9 pr-3 rounded-lg border border-gray-200 bg-white text-sm placeholder-gray-400 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all group-hover:border-gray-300"
            >
            <span class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">🔍</span>
          </div>
          
          <!-- Create Button -->
          <CButton @click="createWorkflow" class="whitespace-nowrap shadow-sm hover:shadow-md transition-shadow">
            <span class="text-lg leading-none mr-1 font-light">+</span> 创建工作流
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
        <div class="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mb-4 text-2xl text-primary">⚡</div>
        <div class="text-gray-900 font-medium mb-1">暂无工作流</div>
        <div class="text-gray-400 text-sm mb-6">创建一个新的工作流开始你的自动化之旅</div>
        <CButton @click="createWorkflow">立即创建</CButton>
      </div>
    </div>

    <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pb-8">
      <!-- Workflow Card (Horizontal Style matching RoleCard) -->
      <div 
        v-for="item in filteredItems" 
        :key="item.id" 
        class="bg-white border border-gray-200 rounded-xl p-4 flex gap-4 hover:shadow-md hover:border-primary transition-all duration-200 cursor-pointer group h-full"
        @click="edit(item.id)"
      >
        <!-- Icon (Left) -->
        <div class="flex-shrink-0">
          <div class="w-14 h-14 rounded-xl bg-blue-50 flex items-center justify-center text-2xl text-primary group-hover:bg-primary group-hover:text-white transition-colors">
            ⚡
          </div>
        </div>

        <!-- Content (Right) -->
        <div class="flex flex-col flex-1 min-w-0 h-full">
          <!-- Header -->
          <div class="flex justify-between items-start mb-1">
            <h3 class="font-bold text-gray-900 text-base truncate pr-2 group-hover:text-primary transition-colors">
              {{ item.name }}
            </h3>
            <!-- Status Badge -->
            <span v-if="item.published" class="text-xs bg-green-50 text-green-600 px-1.5 py-0.5 rounded flex-shrink-0">已发布</span>
            <span v-else class="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded flex-shrink-0">草稿</span>
          </div>

          <!-- Description -->
          <p class="text-xs text-gray-500 line-clamp-2 mb-3 flex-1 h-8 leading-relaxed">
            {{ item.description || "暂无描述信息..." }}
          </p>

          <!-- Footer -->
          <div class="flex items-center justify-between mt-auto pt-2 border-t border-gray-50">
            <div class="flex items-center gap-2 text-xs text-gray-400">
              <span class="bg-gray-50 px-1.5 py-0.5 rounded">v{{ item.version || '1.0' }}</span>
              <span>{{ formatDate(item.updatedAt) }}</span>
            </div>
            
            <!-- Actions (Visible on Hover) -->
            <div class="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
               <button 
                 class="p-1.5 hover:bg-gray-100 rounded text-gray-400 hover:text-primary transition-colors"
                 title="编辑"
                 @click.stop="edit(item.id)"
               >
                 ✎
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

    <!-- Create Workflow Modal -->
    <CModal 
      v-model="showCreateModal" 
      title="创建工作流"
    >
      <div class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">
            工作流名称 <span class="text-red-500">*</span>
          </label>
          <input 
            v-model="createForm.name"
            type="text" 
            class="coze-input w-full" 
            placeholder="请输入工作流名称"
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
            placeholder="请输入工作流描述（选填）"
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
import { ref, onMounted, computed, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { handleError } from '../services/error'
import { api } from '../services/api'
import CButton from '../components/common/CButton.vue'
import CModal from '../components/common/CModal.vue'

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
  { label: '已发布', value: 'published' },
  { label: '草稿箱', value: 'draft' }
]

const filteredItems = computed(() => {
  let result = items.value

  // Tab Filter
  if (currentTab.value === 'published') {
    result = result.filter(item => item.published)
  } else if (currentTab.value === 'draft') {
    result = result.filter(item => !item.published)
  }

  // Search Filter
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
    const res = await api.get('/workflows')
    // Mock published status for demo if not present
    items.value = res.data.map((item: any) => ({
      ...item,
      published: item.published ?? Math.random() > 0.5, // Fallback for demo
      updatedAt: item.updatedAt || new Date().toISOString()
    }))
  } catch (err: any) {
    handleError(err, '加载工作流失败', 'workflow.list')
  } finally {
    loading.value = false
  }
}

const createWorkflow = () => {
  createForm.value = { name: '', description: '' }
  showCreateModal.value = true
  nextTick(() => {
    nameInput.value?.focus()
  })
}

const submitCreate = async () => {
  if (!createForm.value.name.trim()) return
  
  isCreating.value = true
  try {
    const res = await api.post('/workflows', { 
      name: createForm.value.name,
      description: createForm.value.description,
      graphData: JSON.stringify({ nodes: [], edges: [] }) 
    })
    showCreateModal.value = false
    router.push(`/workflows/${res.data.id}/editor`)
  } catch (err: any) {
    handleError(err, '创建失败', 'workflow.create')
  } finally {
    isCreating.value = false
  }
}

const edit = (id: string) => {
  router.push(`/workflows/${id}/editor`)
}

const remove = async (id: string) => {
  if (!window.confirm('确认删除？')) return
  try {
    await api.delete(`/workflows/${id}`)
    await load()
  } catch (err: any) {
    handleError(err, '删除失败', 'workflow.delete')
  }
}

onMounted(load)
</script>
