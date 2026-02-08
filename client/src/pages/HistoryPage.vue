<template>
  <div class="stack">
    <el-card class="stack">
      <strong>会话历史</strong>
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
          <div class="row">
            <strong>{{ item.title }}</strong>
            <span class="muted">{{ item.updatedAt }}</span>
          </div>
          <div class="muted">{{ item.lastMessagePreview }}</div>
          <div class="row">
            <el-button @click="openChat(item.conversationId)">继续对话</el-button>
            <el-button @click="rename(item)">重命名</el-button>
            <el-button type="danger" @click="remove(item.conversationId)">删除</el-button>
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

const router = useRouter()
const store = useConversationStore()
const conversations = computed(() => store.items || [])
const nextCursor = computed(() => store.nextCursor || null)
const loading = ref(false)
const loadingMore = ref(false)
const loadError = ref<string | null>(null)

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
  if (!window.confirm("确认删除该会话？")) return
  try {
    await store.deleteConversation(conversationId)
  } catch (error: any) {
    handleError(error, "删除失败", "history.delete")
  }
}
</script>
