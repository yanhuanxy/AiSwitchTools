<template>
  <div class="stack">
    <el-card>
      <strong>对话</strong>
    </el-card>
    <el-alert v-if="statusText" :title="statusText" type="warning" show-icon />
    <el-card v-if="loadingMessages && messages.length === 0">
      <el-skeleton :rows="3" animated />
    </el-card>
    <el-card v-else-if="loadError" class="stack">
      <span class="muted">{{ loadError }}</span>
      <el-button @click="loadConversation">重试加载</el-button>
    </el-card>
    <el-empty v-else-if="messages.length === 0 && !loadingMessages" description="暂无消息" />
    
    <div v-if="nextCursor" class="text-center py-2">
      <el-button :loading="loadingMore" size="small" text @click="loadHistory">
        加载更多历史消息
      </el-button>
    </div>

    <MessageList :messages="messages" />
    <AttachmentStrip @select="handleAttachments" />
    <Composer :sending="sendDisabled" @send="handleSend">
      <template #actions>
        <TaskControls
          :can-stop="Boolean(activeTask)"
          :can-retry="Boolean(lastAssistantMessage && lastAssistantMessage.id) && !sending && !activeTask"
          :can-continue="Boolean(lastAssistantMessage && lastAssistantMessage.id) && !sending && !activeTask"
          @stop="handleStop"
          @retry="handleRetry"
          @continue="handleContinue"
        />
      </template>
    </Composer>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue"
import { useRoute } from "vue-router"
import MessageList from "../components/MessageList.vue"
import Composer from "../components/Composer.vue"
import TaskControls from "../components/TaskControls.vue"
import AttachmentStrip from "../components/AttachmentStrip.vue"
import { useConversationStore } from "../stores/conversations"
import { useChatStore } from "../stores/chat"
import { useAuthStore } from "../stores/auth"
import { createChatTask, cancelChatTask, retryAssistantMessage, continueAssistantMessage } from "../services/chat"
import { createSseConnection } from "../services/sse"
import { uploadImages } from "../services/attachments"
import { getErrorMessage, handleError, notifyError, reportError } from "../services/error"
import type { Message } from "../types"

const route = useRoute()
const conversationId = computed(() => route.params.conversationId as string)
const conversationStore = useConversationStore()
const chatStore = useChatStore()
const authStore = useAuthStore()
const attachments = ref<File[]>([])
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
const lastAssistantMessage = computed(() => {
  const list = messages.value
  for (let i = list.length - 1; i >= 0; i -= 1) {
    if (list[i].role === "assistant") return list[i]
  }
  return null
})

const loadConversation = async () => {
  loadingMessages.value = true
  loadError.value = null
  try {
    chatStore.initConversation(conversationId.value)
    const data = await conversationStore.loadMessages(conversationId.value)
    if (data?.items) {
      chatStore.setMessages(conversationId.value, data.items)
      nextCursor.value = data.nextCursor || null
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

const handleOnline = () => {
  isOnline.value = true
}

const handleOffline = () => {
  isOnline.value = false
}

onMounted(async () => {
  window.addEventListener("online", handleOnline)
  window.addEventListener("offline", handleOffline)
  await loadConversation()
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

const handleAttachments = (files: File[]) => {
  attachments.value = files
}

const generateClientMessageId = () => {
  if (crypto?.randomUUID) return crypto.randomUUID()
  return `msg_${Date.now()}_${Math.random().toString(16).slice(2)}`
}

const processTypewriter = (assistantMessageId: string) => {
  const state = streamCache.get(assistantMessageId)
  if (!state) return

  if (state.currentText.length < state.targetText.length) {
    // 动态调整速度：滞后越多，步进越大
    const lag = state.targetText.length - state.currentText.length
    // 减慢速度：只有当滞后非常严重时才加速，否则每次只出一个字
    const step = lag > 100 ? 3 : (lag > 50 ? 2 : 1)
    
    const nextChunk = state.targetText.slice(state.currentText.length, state.currentText.length + step)
    state.currentText += nextChunk
    
    chatStore.setStream(assistantMessageId, state.currentText)
    chatStore.updateMessage(conversationId.value, assistantMessageId, {
      content: state.currentText
    })

    // 减慢帧率：从 30ms 调整到 50ms（约 20fps），视觉上会更从容
    state.timerId = window.setTimeout(() => processTypewriter(assistantMessageId), 50)
  } else {
    state.timerId = null
  }
}

const updateStreamText = (assistantMessageId: string, text: string, replace = false) => {
  let state = streamCache.get(assistantMessageId)
  if (!state) {
    state = { targetText: "", currentText: "", timerId: null }
    streamCache.set(assistantMessageId, state)
  }

  if (replace) {
    state.targetText = text
  } else {
    state.targetText += text
  }
  
  if (state.timerId === null) {
    processTypewriter(assistantMessageId)
  }
}

const finalizeStream = (assistantMessageId: string) => {
  const state = streamCache.get(assistantMessageId)
  if (!state) return
  if (state.timerId !== null) {
    window.clearTimeout(state.timerId)
  }
  // 结束时确保显示完整内容
  chatStore.setStream(assistantMessageId, state.targetText)
  chatStore.updateMessage(conversationId.value, assistantMessageId, {
    content: state.targetText
  })
  streamCache.delete(assistantMessageId)
}

const startStream = (assistantMessageId: string) => {
  sseRef.value?.close()
  sseRef.value = createSseConnection({
    url: `/api/chat/tasks/${activeTask.value?.taskId}/events`,
    token: authStore.accessToken,
    handlers: {
      onMeta: () => {},
      onDelta: (data) => {
        const fullText = data?.fullText ?? data?.full
        if (typeof fullText === "string") {
          updateStreamText(assistantMessageId, fullText, true)
        } else {
          const text = data?.text || ""
          if (text) updateStreamText(assistantMessageId, text)
        }
      },
      onDone: () => {
        finalizeStream(assistantMessageId)
        chatStore.updateMessage(conversationId.value, assistantMessageId, {
          status: "completed"
        })
        chatStore.setActiveTask(conversationId.value, null)
        chatStore.clearStream(assistantMessageId)
      },
      onError: (event) => {
        sseErrorCount.value += 1
        finalizeStream(assistantMessageId)
        chatStore.updateMessage(conversationId.value, assistantMessageId, {
          status: "failed"
        })
        chatStore.setActiveTask(conversationId.value, null)
        chatStore.clearStream(assistantMessageId)
        const data = (event as MessageEvent).data
        const message = getErrorMessage(undefined, data)
        notifyError(message)
        reportError({
          message,
          context: "sse.error",
          path: window.location.pathname
        })
      },
      onOpen: () => {
        sseErrorCount.value = 0
      },
      onStatus: (status) => {
        sseStatus.value = status
      }
    }
  })
}

const statusText = computed(() => {
  if (!isOnline.value) return "网络离线，发送可能失败"
  if (sseErrorCount.value >= 3) return "连接多次失败，请稍后重试"
  if (sseStatus.value === "reconnecting") return "网络不稳定，正在重连"
  if (sseStatus.value === "connecting") return "连接中..."
  if (sending.value) return "发送中..."
  if (activeTask.value) return "生成中..."
  return ""
})

const handleSend = async (content: string) => {
  sending.value = true
  try {
    let attachmentIds: string[] = []
    if (attachments.value.length) {
      const result = await uploadImages(attachments.value)
      attachmentIds = result.map((item) => item.attachmentId)
    }
    const clientMessageId = generateClientMessageId()
    const userMessage: Message = {
      id: clientMessageId,
      role: "user",
      content,
      status: "sent",
      createdAt: new Date().toISOString()
    }
    chatStore.appendMessage(conversationId.value, userMessage)
    const task = await createChatTask({
      conversationId: conversationId.value,
      clientMessageId,
      content,
      attachmentIds
    })
    const assistantMessage: Message = {
      id: task.assistantMessageId,
      role: "assistant",
      content: "",
      status: "generating",
      createdAt: new Date().toISOString()
    }
    chatStore.appendMessage(conversationId.value, assistantMessage)
    chatStore.setActiveTask(conversationId.value, {
      taskId: task.taskId,
      assistantMessageId: task.assistantMessageId,
      status: "running"
    })
    startStream(task.assistantMessageId)
  } catch (error: any) {
    handleError(error, "发送失败", "chat.send")
  } finally {
    sending.value = false
  }
}

const handleStop = async () => {
  if (!activeTask.value) return
  await cancelChatTask(activeTask.value.taskId)
  const messageId = activeTask.value.assistantMessageId
  chatStore.updateMessage(conversationId.value, messageId, {
    status: "canceled",
    partial: true
  })
  chatStore.setActiveTask(conversationId.value, null)
  sseRef.value?.close()
}

const handleRetry = async () => {
  const last = lastAssistantMessage.value
  if (!last) return
  try {
    const data = await retryAssistantMessage(last.id)
    chatStore.updateMessage(conversationId.value, last.id, {
      supersededByMessageId: data.assistantMessageId
    })
    const assistantMessage: Message = {
      id: data.assistantMessageId,
      role: "assistant",
      content: "",
      status: "generating",
      createdAt: new Date().toISOString()
    }
    chatStore.appendMessage(conversationId.value, assistantMessage)
    chatStore.setActiveTask(conversationId.value, {
      taskId: data.taskId,
      assistantMessageId: data.assistantMessageId,
      status: "running"
    })
    startStream(data.assistantMessageId)
  } catch (error: any) {
    handleError(error, "重试失败", "chat.retry")
  }
}

const handleContinue = async () => {
  const last = lastAssistantMessage.value
  if (!last) return
  try {
    const data = await continueAssistantMessage(last.id)
    chatStore.setActiveTask(conversationId.value, {
      taskId: data.taskId,
      assistantMessageId: data.assistantMessageId,
      status: "running"
    })
    startStream(data.assistantMessageId)
  } catch (error: any) {
    handleError(error, "续写失败", "chat.continue")
  }
}
</script>
