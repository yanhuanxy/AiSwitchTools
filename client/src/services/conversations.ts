import { apiClient } from "./api"
import type { ApiListResponse, ConversationListItem, Message } from "../types"

export const createConversation = async (characterId: string) => {
  const { data } = await apiClient.post<{
    conversationId: string
    characterVersionId: string
  }>("/conversations", { characterId })
  return data
}

export const fetchConversations = async (params?: {
  cursor?: string | null
  limit?: number
}) => {
  const { data } = await apiClient.get<ApiListResponse<ConversationListItem>>(
    "/conversations",
    { params }
  )
  return data
}

export const fetchMessages = async (
  conversationId: string,
  params?: { cursor?: string | null; limit?: number }
) => {
  const { data } = await apiClient.get<ApiListResponse<Message>>(
    `/conversations/${conversationId}/messages`,
    { params }
  )
  return data
}

export const renameConversation = async (conversationId: string, title: string) => {
  const { data } = await apiClient.patch(`/conversations/${conversationId}`, {
    title
  })
  return data
}

export const deleteConversation = async (conversationId: string) => {
  const { data } = await apiClient.delete(`/conversations/${conversationId}`)
  return data
}

export const batchDeleteConversations = async (ids: string[]) => {
  await apiClient.post("/conversations/batch-delete", { ids })
}

export const restoreConversation = async (id: string) => {
  await apiClient.post(`/conversations/${id}/restore`)
}

export const batchRestoreConversations = async (ids: string[]) => {
  await apiClient.post("/conversations/batch-restore", { ids })
}

export const toggleConversationPin = async (conversationId: string, isPinned: boolean) => {
  await apiClient.post(`/conversations/${conversationId}/pin`, { isPinned })
}
