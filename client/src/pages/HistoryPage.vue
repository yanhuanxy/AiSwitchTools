<template>
  <div class="stack">
    <el-card class="stack">
      <div class="row" style="justify-content: space-between; align-items: center; margin-bottom: 16px;">
        <strong>会话历史</strong>
        <div v-if="conversations.length > 0">
           <el-button v-if="!isSelectionMode" size="small" @click="toggleSelectionMode">批量管理</el-button>
           <template v-else>
             <el-button size="small" type="danger" :disabled="selectedIds.length === 0" @click="batchDelete">
               删除({{ selectedIds.length }})
             </el-button>
             <el-button size="small" @click="toggleSelectionMode">取消</el-button>
           </template>
        </div>
      </div>
      <div v-if="loading" class="list">
        <el-skeleton v-for="n in 3" :key="n" :rows="2" animated />
      </div>
      <div v-else-if="loadError" class="stack">
        <span class="muted">{{ loadError }}</span>
        <el-button @click="loadConversations">重试加载</el-button>
      </div>
      <div v-else-if="!conversations || conversations.length === 0">
        <el-empty description="暂无会话" />
      </div>
      <div v-else class="list">
        <el-card v-for="item in conversations" :key="item.conversationId" class="stack">
          <div style="display: flex; gap: 12px; align-items: flex-start;">
            <div v-if="isSelectionMode" style="padding-top: 4px;">
              <el-checkbox 
                :model-value="selectedIds.includes(item.conversationId)"
                @change="(val) => toggleSelect(item.conversationId, val)"
              />
            </div>
            <div style="flex: 1; min-width: 0;">
              <div class="row">
                <strong>{{ item.title }}</strong>
                <span class="muted">{{ item.updatedAt }}</span>
              </div>
              <div class="muted">{{ item.lastMessagePreview }}</div>
              <div class="row" v-if="!isSelectionMode">
                <el-button @click="openChat(item.conversationId)">继续对话</el-button>
                <el-button @click="rename(item)">重命名</el-button>
                <el-button type="danger" @click="remove(item.conversationId)">删除</el-button>
              </div>
            </div>
          </div>
        </el-card>
      </div>
      <el-button v-if="nextCursor" :disabled="loadingMore" @click="loadMore">加载更多</el-button>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue"
import { useRouter } from "vue-router"
import { useConversationStore } from "../stores/conversations"
import { handleError } from "../services/error"
import type { ConversationListItem } from "../types"
import { ElMessageBox, ElNotification } from "element-plus"

const router = useRouter()
const store = useConversationStore()
const conversations = computed(() => store.items || [])
const nextCursor = computed(() => store.nextCursor || null)
const loading = ref(false)
const loadingMore = ref(false)
const loadError = ref<string | null>(null)

const isSelectionMode = ref(false)
const selectedIds = ref<string[]>([])

const toggleSelectionMode = () => {
  isSelectionMode.value = !isSelectionMode.value
  selectedIds.value = []
}

const toggleSelect = (id: string, val: any) => {
  if (val) {
    selectedIds.value.push(id)
  } else {
    selectedIds.value = selectedIds.value.filter(i => i !== id)
  }
}

const loadConversations = async () => {
  loading.value = true
  loadError.value = null
  try {
    await store.loadConversations()
  } catch (error: any) {
    loadError.value = handleError(error, "加载失败", "history.load")
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadConversations()
})

const loadMore = async () => {
  loadingMore.value = true
  try {
    await store.loadConversations(nextCursor.value)
  } catch (error: any) {
    handleError(error, "加载更多失败", "history.loadMore")
  } finally {
    loadingMore.value = false
  }
}

const openChat = (conversationId: string) => {
  router.push(`/chat/${conversationId}`)
}

const rename = async (item: ConversationListItem) => {
  const title = window.prompt("输入新的会话名称", item.title)
  if (!title) return
  try {
    await store.renameConversation(item.conversationId, title)
  } catch (error: any) {
    handleError(error, "重命名失败", "history.rename")
  }
}

const remove = async (conversationId: string) => {
  try {
    await ElMessageBox.confirm("确认删除该会话？", "删除确认", {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消'
    })
    
    await store.deleteConversation(conversationId)
    ElNotification({
      title: '删除成功',
      message: '点击此处可撤销删除',
      type: 'success',
      duration: 5000,
      onClick: () => {
        store.restore([conversationId])
        ElNotification.closeAll()
      }
    })
  } catch (error: any) {
    if (error !== 'cancel') {
      handleError(error, "删除失败", "history.delete")
    }
  }
}

const batchDelete = async () => {
  if (selectedIds.value.length === 0) return
  try {
    await ElMessageBox.confirm(`确认删除选中的 ${selectedIds.value.length} 个会话？`, "批量删除确认", {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消'
    })
    
    const idsToDelete = [...selectedIds.value]
    await store.batchDelete(idsToDelete)
    
    isSelectionMode.value = false
    selectedIds.value = []
    
    ElNotification({
      title: '批量删除成功',
      message: '点击此处可撤销删除',
      type: 'success',
      duration: 5000,
      onClick: () => {
        store.restore(idsToDelete)
        ElNotification.closeAll()
      }
    })
  } catch (error: any) {
    if (error !== 'cancel') {
      handleError(error, "批量删除失败", "history.batchDelete")
    }
  }
}
</script>
