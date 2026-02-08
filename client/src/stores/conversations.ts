import { defineStore } from "pinia"
import type { ApiListResponse, ConversationListItem, Message } from "../types"
import {
  createConversation,
  deleteConversation,
  fetchConversations,
  fetchMessages,
  renameConversation
} from "../services/conversations"

export const useConversationStore = defineStore("conversations", {
  state: () => ({
    items: [] as ConversationListItem[],
    nextCursor: null as string | null,
    activeConversation: null as {
      conversationId: string
      characterVersionId: string
      title?: string
    } | null,
    messagesByConversationId: {} as Record<string, ApiListResponse<Message>>
  }),
  actions: {
    async loadConversations(cursor?: string | null) {
      const data = await fetchConversations({ cursor, limit: 20 })
      const items = Array.isArray(data?.items) ? data.items : []
      if (cursor) {
        this.items = [...this.items, ...items]
      } else {
        this.items = items
      }
      this.nextCursor = data?.nextCursor || null
    },
    async createConversation(characterId: string) {
      const data = await createConversation(characterId)
      this.activeConversation = {
        conversationId: data.conversationId,
        characterVersionId: data.characterVersionId
      }
      return data
    },
    async loadMessages(conversationId: string, cursor?: string | null) {
      const data = await fetchMessages(conversationId, { cursor, limit: 20 })
      const existing = this.messagesByConversationId[conversationId]
      if (existing && cursor) {
        this.messagesByConversationId[conversationId] = {
          items: [...data.items, ...existing.items],
          nextCursor: data.nextCursor
        }
      } else {
        this.messagesByConversationId[conversationId] = data
      }
      return data
    },
    async renameConversation(conversationId: string, title: string) {
      await renameConversation(conversationId, title)
      this.items = this.items.map((item) =>
        item.conversationId === conversationId ? { ...item, title } : item
      )
    },
    async deleteConversation(conversationId: string) {
      await deleteConversation(conversationId)
      this.items = this.items.filter((item) => item.conversationId !== conversationId)
    }
  }
})
