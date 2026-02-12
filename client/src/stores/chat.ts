import { defineStore } from "pinia"
import type { Message, GenerationTask, AgentState, ThoughtLog, ToolCall } from "../types"

export const useChatStore = defineStore("chat", {
  state: () => ({
    messagesByConversationId: {} as Record<string, Message[]>,
    activeTaskByConversationId: {} as Record<string, GenerationTask | null>,
    streamTextByAssistantMessageId: {} as Record<string, string>,
    agentStateByConversationId: {} as Record<string, AgentState>,
    traceLogsByAssistantMessageId: {} as Record<string, (ThoughtLog | ToolCall)[]>,
    isAgentMode: localStorage.getItem('ai-switch-agent-mode') === 'true'
  }),
  actions: {
    toggleAgentMode() {
      this.isAgentMode = !this.isAgentMode
      localStorage.setItem('ai-switch-agent-mode', String(this.isAgentMode))
    },
    setAgentMode(enabled: boolean) {
      this.isAgentMode = enabled
      localStorage.setItem('ai-switch-agent-mode', String(enabled))
    },
    initConversation(conversationId: string) {
      if (!this.messagesByConversationId[conversationId]) {
        this.messagesByConversationId[conversationId] = []
      }
      if (!this.agentStateByConversationId[conversationId]) {
        this.agentStateByConversationId[conversationId] = "IDLE"
      }
    },
    setAgentState(conversationId: string, state: AgentState) {
        this.agentStateByConversationId[conversationId] = state
    },
    addTraceLog(assistantMessageId: string, log: ThoughtLog | ToolCall) {
        if (!this.traceLogsByAssistantMessageId[assistantMessageId]) {
            this.traceLogsByAssistantMessageId[assistantMessageId] = []
        }
        this.traceLogsByAssistantMessageId[assistantMessageId].push(log)
    },
    setActiveTask(conversationId: string, task: GenerationTask | null) {
      this.activeTaskByConversationId[conversationId] = task
    },
    setMessages(conversationId: string, messages: Message[]) {
      this.messagesByConversationId[conversationId] = messages
    },
    prependMessages(conversationId: string, messages: Message[]) {
      this.initConversation(conversationId)
      this.messagesByConversationId[conversationId].unshift(...messages)
    },
    appendMessage(conversationId: string, message: Message) {
      this.initConversation(conversationId)
      this.messagesByConversationId[conversationId].push(message)
    },
    updateMessage(conversationId: string, messageId: string, patch: Partial<Message>) {
      const list = this.messagesByConversationId[conversationId] || []
      const index = list.findIndex((item) => item.id === messageId)
      if (index >= 0) {
        list[index] = { ...list[index], ...patch }
      }
    },
    appendStream(assistantMessageId: string, text: string) {
      const current = this.streamTextByAssistantMessageId[assistantMessageId] || ""
      this.streamTextByAssistantMessageId[assistantMessageId] = current + text
    },
    setStream(assistantMessageId: string, text: string) {
      this.streamTextByAssistantMessageId[assistantMessageId] = text
    },
    clearStream(assistantMessageId: string) {
      delete this.streamTextByAssistantMessageId[assistantMessageId]
    }
  }
})
