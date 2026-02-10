<template>
  <div class="h-full flex flex-col px-6 py-6">
    <!-- Header Area -->
    <div class="flex-shrink-0 flex flex-col gap-4 mb-6">
      <!-- Top Bar: Title & Global Actions (If any) -->
      <div class="flex items-center justify-between">
        <h1 class="text-2xl font-bold text-gray-900 tracking-tight">我的角色</h1>
        <!-- Optional: Global Actions could go here, but search is better below or inline depending on design -->
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
              placeholder="搜索角色" 
              class="w-full h-9 pl-9 pr-3 rounded-lg border border-gray-200 bg-white text-sm placeholder-gray-400 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all group-hover:border-gray-300"
            >
            <span class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">🔍</span>
          </div>
          
          <!-- Create Button -->
          <RouterLink to="/roles/create">
            <CButton class="whitespace-nowrap shadow-sm hover:shadow-md transition-shadow">
              <span class="text-lg leading-none mr-1 font-light">+</span> 创建角色
            </CButton>
          </RouterLink>
        </div>
      </div>
    </div>

    <!-- Content -->
    <div v-if="loading" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      <CCard v-for="n in 4" :key="n" class="h-32 animate-pulse bg-gray-50 border-transparent" />
    </div>

    <div v-else-if="error" class="flex-1 flex items-center justify-center">
      <div class="text-center">
        <div class="text-gray-400 mb-2">⚠️</div>
        <span class="text-gray-500 mb-4 block">{{ error }}</span>
        <CButton variant="secondary" @click="loadRoles">重试加载</CButton>
      </div>
    </div>

    <div v-else-if="!roles || roles.length === 0" class="flex-1 flex items-center justify-center bg-white rounded-xl border border-gray-100 border-dashed">
      <div class="text-center py-16 flex flex-col items-center">
        <div class="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4 text-2xl text-gray-300">🤖</div>
        <div class="text-gray-900 font-medium mb-1">暂无角色</div>
        <div class="text-gray-400 text-sm mb-6">创建一个角色，开始你的智能体之旅</div>
        <RouterLink to="/roles/create">
          <CButton>立即创建</CButton>
        </RouterLink>
      </div>
    </div>

    <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pb-8">
      <RoleCard v-for="item in roles" :key="item.id" :role="item" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue"
import { useRoleStore } from "../stores/roles"
import RoleCard from "../components/RoleCard.vue"
import CButton from "../components/common/CButton.vue"
import CCard from "../components/common/CCard.vue"
import { handleError } from "../services/error"

const store = useRoleStore()
const roles = computed(() => store.roles)
const loading = ref(false)
const error = ref<string | null>(null)
const searchQuery = ref("")

const tabs = [
  { label: '我创建的', value: 'created' },
  { label: '我收藏的', value: 'favorites' }
]
const currentTab = ref('created')

const loadRoles = async () => {
  loading.value = true
  error.value = null
  try {
    await store.loadRoles({
      search: searchQuery.value,
      favorites: currentTab.value === 'favorites'
    })
  } catch (err: any) {
    error.value = handleError(err, "加载角色失败", "roles.load")
  } finally {
    loading.value = false
  }
}

let debounceTimer: ReturnType<typeof setTimeout> | null = null
const debouncedLoad = () => {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    loadRoles()
  }, 300)
}

watch(currentTab, () => {
  loadRoles()
})

watch(searchQuery, () => {
  debouncedLoad()
})

onMounted(() => {
  loadRoles()
})
</script>
