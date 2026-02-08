import { defineStore } from "pinia"
import type { Message, GenerationTask } from "../types"

export const useChatStore = defineStore("chat", {
  state: () => ({
    messagesByConversationId: {} as Record<string, Message[]>,
    activeTaskByConversationId: {} as Record<string, GenerationTask | null>,
    streamTextByAssistantMessageId: {} as Record<string, string>
  }),
  actions: {
    initConversation(conversationId: string) {
      if (!this.messagesByConversationId[conversationId]) {
        this.messagesByConversationId[conversationId] = []
      }
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
