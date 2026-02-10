import { defineStore } from "pinia"
import type { ApiListResponse, ConversationListItem, Message } from "../types"
import {
  createConversation,
  deleteConversation,
  batchDeleteConversations,
  restoreConversation,
  batchRestoreConversations,
  toggleConversationPin,
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
    },
    async batchDelete(ids: string[]) {
      await batchDeleteConversations(ids)
      this.items = this.items.filter((item) => !ids.includes(item.conversationId))
    },
    async restore(ids: string[]) {
      if (ids.length === 1) {
        await restoreConversation(ids[0])
      } else {
        await batchRestoreConversations(ids)
      }
      // Refresh list to get restored items back
      await this.loadConversations(null)
    },
    async togglePin(conversationId: string, isPinned: boolean) {
      await toggleConversationPin(conversationId, isPinned)
      // Optimistic update
      this.items = this.items.map((item) =>
        item.conversationId === conversationId ? { ...item, isPinned } : item
      )
      // Re-sort: Pinned first, then UpdatedAt
      this.items.sort((a, b) => {
        if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      })
      
      // If we are strictly relying on backend sort for cursor pagination, optimistic sort is fine for current page,
      // but reloading is safer to ensure consistency with backend cursor.
      // However, for user experience, immediate sort is better.
    }
  }
})
