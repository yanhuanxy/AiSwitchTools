<template>
  <div class="h-screen bg-white flex font-sans overflow-hidden">
    <!-- Sidebar -->
    <aside class="w-64 bg-[#F9FAFB] border-r border-gray-border flex flex-col flex-shrink-0 z-20">
      <!-- Logo Area -->
      <div class="h-16 flex items-center px-4 flex-shrink-0">
        <div class="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-white font-bold text-lg mr-3 shadow-sm">T</div>
        <strong class="text-lg font-bold text-gray-900 truncate tracking-tight">Tools 智能体</strong>
      </div>

      <!-- New Chat Button -->
      <div class="px-3 pb-2">
        <button 
          @click="handleNewChat"
          class="w-full h-10 bg-white border border-gray-200 rounded-lg shadow-sm hover:border-primary hover:text-primary hover:shadow-md transition-all duration-200 flex items-center justify-center gap-2 text-sm font-medium text-gray-700 group"
        >
          <span class="text-lg leading-none group-hover:scale-110 transition-transform">+</span> 新对话
        </button>
      </div>

      <!-- Navigation -->
      <div class="flex-1 overflow-y-auto px-3 space-y-6 py-2 scrollbar-hide">
        <!-- Main Nav -->
        <div class="space-y-1">
           <router-link v-for="item in navItems" :key="item.path" :to="item.path"
            class="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-200"
            :class="activePath.startsWith(item.path) 
              ? 'bg-gray-200 text-gray-900' 
              : 'text-gray-600 hover:bg-gray-200 hover:text-gray-900'"
          >
            <!-- Icons -->
            <div class="w-5 h-5 flex items-center justify-center opacity-80">
               <span v-if="item.icon === 'chat'">🧩</span>
               <span v-else-if="item.icon === 'workflow'">⚡</span>
               <span v-else-if="item.icon === 'kb'">📚</span>
            </div>
            {{ item.label }}
          </router-link>
        </div>

        <!-- History Section -->
        <div class="pt-2 border-t border-gray-200">
          <div class="px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">历史对话</div>
          
          <div v-if="loadingHistory" class="space-y-2 px-3">
             <div v-for="n in 3" :key="n" class="h-4 bg-gray-200 rounded w-3/4 animate-pulse"></div>
          </div>
          
          <div v-else-if="historyItems.length === 0" class="px-3 py-4 text-center text-xs text-gray-400">
            暂无历史记录
          </div>

          <div v-else class="space-y-0.5">
             <div 
               v-for="conv in visibleHistory" 
               :key="conv.conversationId"
               @click="openConversation(conv.conversationId)"
               class="px-3 py-2 text-sm rounded-lg cursor-pointer truncate transition-colors duration-150 flex items-center gap-2 group relative pr-8"
               :class="activePath.includes(conv.conversationId) ? 'bg-white shadow-sm text-primary' : 'text-gray-600 hover:bg-gray-200'"
             >
               <span class="text-xs opacity-70" v-if="conv.isPinned">📌</span>
               <span class="text-xs opacity-70" v-else>💬</span>
               <span class="truncate flex-1">{{ conv.title || '未命名会话' }}</span>
               
               <!-- More Actions -->
               <div class="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity" @click.stop>
                 <el-dropdown trigger="click" @command="(cmd: string) => handleHistoryCommand(cmd, conv)" popper-class="history-action-popper">
                   <div class="p-1 hover:bg-gray-300 rounded text-gray-500 transition-colors">
                     <span class="text-xs leading-none">•••</span>
                   </div>
                   <template #dropdown>
                     <el-dropdown-menu>
                       <el-dropdown-item command="pin">
                         <div class="flex items-center gap-2 min-w-[80px]">
                            <span class="text-lg">{{ conv.isPinned ? '🚫' : '📌' }}</span>
                            <span class="hidden sm:inline">{{ conv.isPinned ? '取消置顶' : '置顶' }}</span>
                         </div>
                       </el-dropdown-item>
                       <el-dropdown-item command="delete" class="text-red-500">
                         <div class="flex items-center gap-2 min-w-[80px]">
                            <span class="text-lg">🗑️</span>
                            <span class="hidden sm:inline">删除</span>
                         </div>
                       </el-dropdown-item>
                     </el-dropdown-menu>
                   </template>
                 </el-dropdown>
               </div>
             </div>
             
             <!-- View All Link -->
             <div v-if="hasMoreHistory" class="px-3 py-2 text-center">
               <a 
                 @click.prevent="goToHistoryPage" 
                 class="text-xs text-gray-400 hover:text-primary cursor-pointer transition-colors flex items-center justify-center gap-1"
               >
                 查看全部历史会话 <span>→</span>
               </a>
             </div>
          </div>
        </div>
      </div>

      <!-- User Profile -->
      <div class="p-3 border-t border-gray-border bg-[#F9FAFB] flex-shrink-0">
        <el-dropdown trigger="click" @command="handleCommand" class="w-full">
          <div class="flex items-center gap-3 cursor-pointer hover:bg-gray-200 p-2 rounded-lg transition-colors w-full group">
            <el-image 
               class="w-9 h-9 rounded-full bg-primary-light flex-shrink-0 border border-gray-200 group-hover:border-primary transition-colors"
               src="https://cube.elemecdn.com/3/7c/3ea6beec64369c2642b92c6726f1epng.png"
               fit="cover"
            >
               <template #error>
                  <div class="w-full h-full flex items-center justify-center text-primary font-bold">U</div>
               </template>
            </el-image>
            
            <div class="flex-1 min-w-0 text-left">
              <el-tooltip :content="userName" placement="top" :show-after="500">
                 <div class="text-sm font-medium text-gray-900 truncate">{{ userName }}</div>
              </el-tooltip>
            </div>
            
            <div class="text-gray-400 group-hover:text-gray-600">
              <span class="text-xs">▼</span>
            </div>
          </div>
          <template #dropdown>
            <el-dropdown-menu class="w-48">
              <div class="px-4 py-2 text-xs text-gray-400">设置</div>
              <el-dropdown-item command="profile" class="gap-2">
                <span>👤</span> 个人设置
              </el-dropdown-item>
              <el-dropdown-item command="theme" class="gap-2">
                <span>🌙</span> 深色模式 (开发中)
              </el-dropdown-item>
              <el-dropdown-item command="logout" divided class="text-danger gap-2">
                <span>🚪</span> 退出登录
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
    </aside>

    <!-- Main Content -->
    <main class="flex-1 flex flex-col min-w-0 bg-white relative">
      <RouterView v-slot="{ Component }">
        <transition name="fade" mode="out-in">
          <component :is="Component" />
        </transition>
      </RouterView>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue"
import { useRoute, useRouter } from "vue-router"
import { useAuthStore } from "./stores/auth"
import { useConversationStore } from "./stores/conversations"
import { useRoleStore } from "./stores/roles"
import { ElMessage, ElMessageBox } from "element-plus"

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const conversationStore = useConversationStore()
const roleStore = useRoleStore()

const activePath = computed(() => route.path)
const userName = computed(() => 'User') // Replace with actual user name from store if available
const historyItems = computed(() => conversationStore.items)
const visibleHistory = computed(() => historyItems.value.slice(0, 10))
const hasMoreHistory = computed(() => historyItems.value.length > 10)
const loadingHistory = ref(false)

const handleHistoryCommand = async (command: string, conv: any) => {
  if (command === 'pin') {
    try {
      await conversationStore.togglePin(conv.conversationId, !conv.isPinned)
      ElMessage.success(conv.isPinned ? '已置顶' : '已取消置顶')
    } catch (error) {
      ElMessage.error('操作失败')
    }
  } else if (command === 'delete') {
    try {
      await ElMessageBox.confirm('确认删除该会话？', '删除确认', {
        type: 'warning',
        confirmButtonText: '删除',
        cancelButtonText: '取消'
      })
      await conversationStore.deleteConversation(conv.conversationId)
      ElMessage.success('删除成功')
      if (activePath.value.includes(conv.conversationId)) {
        router.push('/')
      }
    } catch (error) {
      if (error !== 'cancel') ElMessage.error('删除失败')
    }
  }
}

const goToHistoryPage = () => {
  router.push('/history?from=app')
}

const navItems = [
  { label: '我的角色', path: '/roles', icon: 'chat' },
  { label: '工作流', path: '/workflows', icon: 'workflow' },
  { label: '知识库', path: '/knowledge-bases', icon: 'kb' },
]

const loadHistory = async () => {
  loadingHistory.value = true
  try {
    await conversationStore.loadConversations()
  } catch (error) {
    console.error("Failed to load history", error)
  } finally {
    loadingHistory.value = false
  }
}

const handleNewChat = async () => {
  try {
    // Check if there are any roles
    if (roleStore.roles.length === 0) {
       await roleStore.loadRoles()
    }
    
    let targetRoleId = roleStore.roles[0]?.id
    
    // If no roles exist, maybe redirect to create role
    if (!targetRoleId) {
      ElMessage.warning("请先创建一个角色")
      router.push('/roles/create')
      return
    }

    const conv = await conversationStore.createConversation(targetRoleId)
    router.push(`/chat/${conv.conversationId}`)
    
    // Refresh history
    await loadHistory()
  } catch (error) {
    ElMessage.error("创建对话失败")
  }
}

const openConversation = (id: string) => {
  router.push(`/chat/${id}`)
}

const handleCommand = (command: string) => {
  if (command === 'logout') {
    handleLogoutConfirm()
  } else if (command === 'profile') {
    router.push('/auth/bind')
  } else if (command === 'theme') {
    ElMessage.info("深色模式即将上线")
  }
}

const handleLogoutConfirm = () => {
  ElMessageBox.confirm(
    '确定要退出登录吗？本地缓存将被清除。',
    '退出登录',
    {
      confirmButtonText: '退出',
      cancelButtonText: '取消',
      type: 'warning',
    }
  )
    .then(() => {
      handleLogout()
    })
    .catch(() => {
      // cancel
    })
}

const handleLogout = async () => {
  await authStore.logout()
  // Clear conversation store (optional if pinia setup correctly clears on logout)
  conversationStore.$reset()
  ElMessage.success("已退出登录")
  router.push("/")
}

onMounted(() => {
  if (authStore.accessToken) {
    loadHistory()
  }
})
</script>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* Custom Scrollbar for Sidebar */
.scrollbar-hide::-webkit-scrollbar {
    display: none;
}
.scrollbar-hide {
    -ms-overflow-style: none;
    scrollbar-width: none;
}
</style>

<style>
/* Global styles for dropdown */
.history-action-popper .el-dropdown-menu__item {
  padding: 8px 12px;
}
.history-action-popper .el-dropdown-menu__item:focus,
.history-action-popper .el-dropdown-menu__item:not(.is-disabled):hover {
  background-color: #F3F4F6;
  color: inherit;
}
@media (max-width: 375px) {
  .history-action-popper .hidden.sm\:inline {
    display: none;
  }
}
</style>