<template>
  <div class="h-full flex flex-col relative bg-gray-50">
    <!-- Header Area (Title + Actions) -->
    <header class="h-14 bg-white border-b border-gray-border flex items-center justify-between px-6 flex-shrink-0 z-10">
      <div class="flex items-center gap-2">
        <h1 class="text-base font-bold text-gray-900">对话</h1>
        <el-tag v-if="statusText" type="warning" size="small" effect="plain" class="ml-2">{{ statusText }}</el-tag>
      </div>
      <div class="flex items-center gap-2">
         <button @click="handleShare" class="text-gray-500 hover:text-primary transition-colors p-1.5 rounded-md hover:bg-gray-100" title="分享">
           <span class="text-lg">↗</span>
         </button>
         <button class="text-gray-500 hover:text-primary transition-colors p-1.5 rounded-md hover:bg-gray-100" title="更多">
           <span class="text-lg">···</span>
         </button>
      </div>
    </header>

    <!-- Share Dialog -->
    <el-dialog
      v-model="showShareDialog"
      title="分享对话"
      width="400px"
      align-center
    >
      <div class="space-y-4">
        <div 
          class="p-4 border border-gray-100 rounded-xl hover:bg-gray-50 cursor-pointer transition-colors flex items-center gap-3"
          @click="shareLink"
        >
          <div class="w-10 h-10 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center text-xl">🔗</div>
          <div>
            <div class="font-bold text-gray-900">复制链接</div>
            <div class="text-xs text-gray-500">分享对话链接给好友</div>
          </div>
        </div>
        
        <div 
          class="p-4 border border-gray-100 rounded-xl hover:bg-gray-50 cursor-pointer transition-colors flex items-center gap-3"
          @click="shareText"
        >
          <div class="w-10 h-10 bg-green-50 text-green-500 rounded-full flex items-center justify-center text-xl">📝</div>
          <div>
            <div class="font-bold text-gray-900">复制文本</div>
            <div class="text-xs text-gray-500">复制纯文本格式的对话内容</div>
          </div>
        </div>

        <div 
          class="p-4 border border-gray-100 rounded-xl bg-gray-50 cursor-not-allowed opacity-60 flex items-center gap-3"
          title="暂未支持"
        >
          <div class="w-10 h-10 bg-orange-50 text-orange-500 rounded-full flex items-center justify-center text-xl">🖼️</div>
          <div>
            <div class="font-bold text-gray-900">生成图片</div>
            <div class="text-xs text-gray-500">生成长图分享 (开发中)</div>
          </div>
        </div>
      </div>
    </el-dialog>

    <!-- Chat Area -->
    <div class="flex-1 overflow-y-auto px-4 py-6 scroll-smooth" id="chat-container">
      <div class="max-w-3xl mx-auto space-y-6">
        <!-- Loading State -->
        <div v-if="loadingMessages && messages.length === 0" class="space-y-4">
          <div class="flex gap-3">
             <div class="w-8 h-8 rounded-full bg-gray-200 animate-pulse"></div>
             <div class="flex-1 space-y-2">
                <div class="h-4 bg-gray-200 rounded w-1/3 animate-pulse"></div>
                <div class="h-4 bg-gray-200 rounded w-1/2 animate-pulse"></div>
             </div>
          </div>
        </div>

        <!-- Error State -->
        <div v-else-if="loadError" class="text-center py-10">
          <div class="text-gray-400 mb-4">{{ loadError }}</div>
          <CButton variant="secondary" @click="loadConversation">重试加载</CButton>
        </div>

        <!-- Empty State -->
        <div v-else-if="messages.length === 0 && !loadingMessages" class="text-center py-20">
          <div class="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">👋</div>
          <h3 class="text-lg font-medium text-gray-900 mb-2">准备好了吗？</h3>
          <p class="text-gray-500">把你的难题抛给我，我们开始吧。</p>
        </div>

        <!-- Load More -->
        <div v-if="nextCursor" class="text-center py-2">
          <button 
            :disabled="loadingMore"
            class="text-xs text-primary hover:underline disabled:opacity-50"
            @click="loadHistory"
          >
            {{ loadingMore ? '加载中...' : '查看更早的消息' }}
          </button>
        </div>

        <!-- Messages -->
        <MessageList :messages="messages" />
      </div>
    </div>

    <!-- Input Area -->
    <div class="flex-shrink-0 bg-white">
      <div class="max-w-3xl mx-auto">
         <Composer 
            :sending="sendDisabled" 
            :can-stop="Boolean(activeTask)"
            @send="handleSend"
            @stop="handleStop"
          >
            <template #actions>
              <TaskControls
                :can-retry="Boolean(lastAssistantMessage && lastAssistantMessage.id) && !sending && !activeTask"
                :can-continue="Boolean(lastAssistantMessage && lastAssistantMessage.id) && !sending && !activeTask"
                @retry="handleRetry"
                @continue="handleContinue"
              />
            </template>
         </Composer>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, nextTick } from "vue"
import { useRoute } from "vue-router"
import MessageList from "../components/MessageList.vue"
import Composer from "../components/Composer.vue"
import TaskControls from "../components/TaskControls.vue"
import CButton from "../components/common/CButton.vue"
import { useConversationStore } from "../stores/conversations"
import { useChatStore } from "../stores/chat"
import { useAuthStore } from "../stores/auth"
import { createChatTask, cancelChatTask, retryAssistantMessage, continueAssistantMessage } from "../services/chat"
import { createSseConnection } from "../services/sse"
import { getErrorMessage, handleError, notifyError, reportError } from "../services/error"
import { ElMessage } from "element-plus"

const showShareDialog = ref(false)

const handleShare = () => {
  showShareDialog.value = true
}

const shareLink = async () => {
  try {
    await navigator.clipboard.writeText(window.location.href)
    ElMessage.success("链接已复制到剪贴板")
    showShareDialog.value = false
  } catch (e) {
    ElMessage.error("复制失败，请手动复制")
  }
}

const shareText = async () => {
  try {
    const text = messages.value
      .map(m => `${m.role === 'user' ? '我' : 'AI'}: ${m.content}`)
      .join('\n\n')
    await navigator.clipboard.writeText(text)
    ElMessage.success("对话文本已复制")
    showShareDialog.value = false
  } catch (e) {
    ElMessage.error("复制失败")
  }
}

import type { Message } from "../types"

const route = useRoute()
const conversationId = computed(() => route.params.conversationId as string)
const conversationStore = useConversationStore()
const chatStore = useChatStore()
const authStore = useAuthStore()
const sending = ref(false)
const sseRef = ref<{ close: () => void } | null>(null)
const loadingMessages = ref(false)
const loadError = ref<string | null>(null)
const isOnline = ref(navigator.onLine)
const sseStatus = ref<"connecting" | "open" | "reconnecting" | "closed" | null>(null)
const sseErrorCount = ref(0)
const streamCache = new Map<string, { targetText: string; currentText: string; timerId: number | null }>()
const nextCursor = ref<string | null>(null)
const loadingMore = ref(false)

const messages = computed(() => chatStore.messagesByConversationId[conversationId.value] || [])
const activeTask = computed(() => chatStore.activeTaskByConversationId[conversationId.value] || null)
const sendDisabled = computed(() => sending.value || !isOnline.value)
const statusText = computed(() => !isOnline.value ? '网络已断开' : null)

const lastAssistantMessage = computed(() => {
  const list = messages.value
  for (let i = list.length - 1; i >= 0; i -= 1) {
    if (list[i].role === "assistant") return list[i]
  }
  return null
})

const scrollToBottom = () => {
  nextTick(() => {
    const container = document.getElementById('chat-container')
    if (container) {
      container.scrollTop = container.scrollHeight
    }
  })
}

const loadConversation = async () => {
  loadingMessages.value = true
  loadError.value = null
  try {
    chatStore.initConversation(conversationId.value)
    const data = await conversationStore.loadMessages(conversationId.value)
    if (data?.items) {
      chatStore.setMessages(conversationId.value, data.items)
      nextCursor.value = data.nextCursor || null
      scrollToBottom()
    }
  } catch (error: any) {
    loadError.value = handleError(error, "加载失败", "chat.loadMessages")
  } finally {
    loadingMessages.value = false
  }
}

const loadHistory = async () => {
  if (!nextCursor.value) return
  loadingMore.value = true
  try {
    const data = await conversationStore.loadMessages(conversationId.value, nextCursor.value)
    if (data?.items) {
      chatStore.prependMessages(conversationId.value, data.items)
      nextCursor.value = data.nextCursor || null
    }
  } catch (error: any) {
    notifyError("加载历史消息失败")
  } finally {
    loadingMore.value = false
  }
}

const handleSend = async (content: string, attachmentIds: string[] = []) => {
  if (sending.value) return
  sending.value = true
  
  const clientMsgId = generateClientMessageId()
  const tempMsg: Message = {
    id: clientMsgId,
    role: 'user',
    content,
    status: 'sent',
    createdAt: new Date().toISOString()
  }
  
  try {
     // 1. Optimistic UI update
     chatStore.appendMessage(conversationId.value, tempMsg)
     scrollToBottom()

     // 2. Create Chat Task
     const { taskId, userMessageId, assistantMessageId } = await createChatTask({
       conversationId: conversationId.value,
       clientMessageId: clientMsgId,
       content,
       attachmentIds
     })
     
     // 3. Update local state with real IDs
     // Update user message ID
     chatStore.updateMessage(conversationId.value, clientMsgId, { id: userMessageId })
     
     // Add assistant placeholder
     const assistantMsg: Message = {
       id: assistantMessageId,
       role: 'assistant',
       content: '',
       status: 'generating',
       createdAt: new Date().toISOString()
     }
     chatStore.appendMessage(conversationId.value, assistantMsg)
     
     // 5. Connect SSE
     connectSse(taskId, assistantMessageId)
     
  } catch (err: any) {
    console.error("Send message failed:", err)
    // Mark message as failed
    chatStore.updateMessage(conversationId.value, clientMsgId, { status: 'failed' })
    
    const msg = err.message || "发送失败"
    notifyError(msg)
  } finally {
    sending.value = false
  }
}

// Map to store active typewriter loops/flags if needed
const activeTypewriters = new Set<string>()

const startTypewriter = (assistantMessageId: string) => {
  if (activeTypewriters.has(assistantMessageId)) return
  activeTypewriters.add(assistantMessageId)
  
  // Capture conversation ID when typewriter starts to support background updates
  const targetConversationId = conversationId.value
  let lastTime = 0
  
  // Base typing interval in ms (larger = slower)
  // 50ms is about 20 chars/sec, comfortable for reading
  const BASE_INTERVAL = 50 

  const loop = (timestamp: number) => {
    // Check if still active
    if (!activeTypewriters.has(assistantMessageId)) return

    const fullText = chatStore.streamTextByAssistantMessageId[assistantMessageId] || ""
    const messages = chatStore.messagesByConversationId[targetConversationId] || []
    const msg = messages.find(m => m.id === assistantMessageId)
    
    if (!msg) {
       activeTypewriters.delete(assistantMessageId)
       return
    }

    const currentContent = msg.content || ""
    const remaining = fullText.length - currentContent.length
    
    if (remaining > 0) {
      // Dynamic speed control
      let interval = BASE_INTERVAL
      let charsToAdd = 1
      
      // Catch up logic
      if (remaining > 50) {
         // Very far behind: speed up significantly
         interval = 5
         charsToAdd = 2
      } else if (remaining > 10) {
         // Slightly behind: speed up a bit
         interval = 20
      }
      
      if (timestamp - lastTime >= interval) {
        const nextContent = fullText.slice(0, currentContent.length + charsToAdd)
        
        chatStore.updateMessage(targetConversationId, assistantMessageId, {
          content: nextContent,
          status: 'generating'
        })
        
        // Only scroll if currently viewing this conversation
        if (conversationId.value === targetConversationId) {
          scrollToBottom()
        }
        
        lastTime = timestamp
      }
      
      requestAnimationFrame(loop)
    } else {
      activeTypewriters.delete(assistantMessageId)
      
      // If task is done (no active task for this conversation), mark message as completed
      const task = chatStore.activeTaskByConversationId[targetConversationId]
      if (!task) {
          chatStore.updateMessage(targetConversationId, assistantMessageId, {
            status: 'completed'
          })
          chatStore.clearStream(assistantMessageId)
      }
    }
  }
  
  requestAnimationFrame(loop)
}

const connectSse = (taskId: string, assistantMessageId: string) => {
  if (sseRef.value) {
    sseRef.value.close()
  }
  
  chatStore.setActiveTask(conversationId.value, {
    taskId,
    assistantMessageId,
    status: 'running'
  })

  // Clear any existing stream buffer
  chatStore.setStream(assistantMessageId, "")

  sseRef.value = createSseConnection({
    url: `/api/chat/tasks/${taskId}/events`,
    token: authStore.accessToken,
    handlers: {
      onOpen: () => {
        console.log("SSE Connected")
      },
      onMeta: (data) => {
        console.log("SSE Meta:", data)
      },
      onDelta: (data) => {
        if (data && data.text) {
          chatStore.appendStream(assistantMessageId, data.text)
          startTypewriter(assistantMessageId)
        }
      },
      onDone: (data) => {
        console.log("SSE Done")
        chatStore.setActiveTask(conversationId.value, null)
        
        // If typewriter is not running (already caught up), finish immediately
        if (!activeTypewriters.has(assistantMessageId)) {
           chatStore.updateMessage(conversationId.value, assistantMessageId, {
            status: 'completed'
          })
          chatStore.clearStream(assistantMessageId)
        }
      },
      onError: (err) => {
        console.error("SSE Error:", err)
      }
    }
  })
}

// ... (Other handlers: handleStop, handleRetry, handleContinue - keep existing logic but ensure UI calls them)
const handleStop = async () => {
  if (activeTask.value) {
    await cancelChatTask(activeTask.value.taskId)
  }
}
const handleRetry = async () => {
   if (lastAssistantMessage.value) {
      await retryAssistantMessage(lastAssistantMessage.value.id)
   }
}
const handleContinue = async () => {
   if (lastAssistantMessage.value) {
      await continueAssistantMessage(lastAssistantMessage.value.id)
   }
}


const handleOnline = () => { isOnline.value = true }
const handleOffline = () => { isOnline.value = false }

const generateClientMessageId = () => {
  if (crypto?.randomUUID) return crypto.randomUUID()
  return `msg_${Date.now()}_${Math.random().toString(16).slice(2)}`
}

onMounted(async () => {
  window.addEventListener("online", handleOnline)
  window.addEventListener("offline", handleOffline)
  if (conversationId.value) {
    await loadConversation()
  }
})

onBeforeUnmount(() => {
  sseRef.value?.close()
  window.removeEventListener("online", handleOnline)
  window.removeEventListener("offline", handleOffline)
  streamCache.forEach((value) => {
    if (value.timerId !== null) window.clearTimeout(value.timerId)
  })
  streamCache.clear()
})
</script>
