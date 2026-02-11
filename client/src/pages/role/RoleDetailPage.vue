<template>
  <div class="w-[90%] mx-auto p-4 md:p-6 lg:p-8">
    <!-- Header with Back Button -->
    <div class="flex items-center gap-4 mb-6">
      <button @click="router.back()" class="p-2 rounded-full hover:bg-gray-100 transition-colors text-gray-600">
        ←
      </button>
      <h1 class="text-2xl font-bold text-gray-900">角色详情</h1>
    </div>

    <div v-if="role" class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      <!-- Left Column: Role Info -->
      <div class="lg:col-span-4 xl:col-span-3 space-y-6 lg:sticky lg:top-6">
        <CCard>
          <div class="flex flex-col items-center text-center p-4">
            <div class="w-24 h-24 rounded-2xl bg-gray-100 flex items-center justify-center text-4xl mb-4">
              {{ role.name.charAt(0) }}
            </div>
            <h2 class="text-xl font-bold text-gray-900 mb-1">{{ role.name }}</h2>
            <div class="flex items-center gap-2 mb-4">
               <span class="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">私有</span>
            </div>
            <p class="text-sm text-gray-500 mb-6 leading-relaxed">
              {{ role.bio || "暂无简介" }}
            </p>
            
            <div class="flex flex-col gap-3 w-full">
              <CButton @click="startChat" class="w-full justify-center">开始对话</CButton>
              <CButton variant="secondary" @click="editRole" class="w-full justify-center">编辑配置</CButton>
            </div>
          </div>
        </CCard>
      </div>

      <!-- Right Column: Version History & Stats -->
      <div class="lg:col-span-8 xl:col-span-9 space-y-6">
        <CCard>
          <div class="border-b border-gray-100 pb-4 mb-6 flex justify-between items-center">
            <h2 class="text-lg font-bold text-gray-900">版本历史</h2>
            <span class="text-xs text-gray-400">共 {{ versions?.length || 0 }} 个版本</span>
          </div>
          
          <div v-if="!versions || versions.length === 0" class="flex flex-col items-center justify-center py-12 text-gray-400">
            <div class="text-4xl mb-2">📜</div>
            <p>暂无版本记录</p>
          </div>
          
          <div v-else class="space-y-4">
            <div v-for="item in versions" :key="item.id" class="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-100 hover:border-gray-200 transition-colors">
              <div class="flex items-center gap-4">
                <div class="w-10 h-10 rounded-full bg-white flex items-center justify-center font-bold text-gray-700 border border-gray-100">
                  v{{ item.version }}
                </div>
                <div>
                  <div class="flex items-center gap-2">
                    <span class="font-medium text-gray-900">版本 v{{ item.version }}</span>
                    <span 
                      class="text-xs px-1.5 py-0.5 rounded"
                      :class="item.status === 'published' ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'"
                    >
                      {{ item.status === 'published' ? '已发布' : '草稿' }}
                    </span>
                  </div>
                  <div class="text-xs text-gray-500 mt-0.5">
                    创建于 {{ formatDate(item.createdAt) }}
                  </div>
                </div>
              </div>
              
              <!-- Optional: Actions for version (view config, rollback, etc) could go here -->
            </div>
          </div>
        </CCard>
      </div>
    </div>

    <!-- Loading State -->
    <div v-else-if="loading" class="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <div class="lg:col-span-4 xl:col-span-3">
        <CCard class="h-96 animate-pulse bg-gray-50" />
      </div>
      <div class="lg:col-span-8 xl:col-span-9">
        <CCard class="h-64 animate-pulse bg-gray-50" />
      </div>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="flex flex-col items-center justify-center py-20">
      <div class="text-4xl mb-4">⚠️</div>
      <p class="text-gray-500 mb-4">{{ error }}</p>
      <CButton @click="loadData">重试加载</CButton>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue"
import { useRoute, useRouter } from "vue-router"
import { useRoleStore } from "../../stores/roles"
import { useConversationStore } from "../../stores/conversations"
import { handleError } from "../../services/error"
import CCard from "../../components/common/CCard.vue"
import CButton from "../../components/common/CButton.vue"

const route = useRoute()
const router = useRouter()
const roleStore = useRoleStore()
const conversationStore = useConversationStore()
const roleId = computed(() => route.params.id as string)
const loading = ref(false)
const error = ref<string | null>(null)

const role = computed(() => roleStore.activeRole)
const versions = computed(() => roleStore.activeVersions)

const formatDate = (dateStr?: string) => {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleString()
}

const loadData = async () => {
  loading.value = true
  error.value = null
  try {
    await roleStore.loadRoleDetail(roleId.value)
  } catch (err: any) {
    error.value = handleError(err, "加载角色详情失败", "role.detail")
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadData()
})

const startChat = async () => {
  try {
    const data = await conversationStore.createConversation(roleId.value)
    router.push(`/chat/${data.conversationId}`)
  } catch (err: any) {
    handleError(err, "创建会话失败", "chat.create")
  }
}

const editRole = () => {
  router.push(`/roles/${roleId.value}/edit`)
}
</script>