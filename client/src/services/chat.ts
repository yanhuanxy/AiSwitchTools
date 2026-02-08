import { apiClient } from "./api"

export const createChatTask = async (payload: {
  conversationId: string
  clientMessageId: string
  content: string
  attachmentIds?: string[]
  replyLength?: "short" | "medium" | "long" | "auto"
}) => {
  const { data } = await apiClient.post<{
    userMessageId: string
    assistantMessageId: string
    taskId: string
  }>("/chat/tasks", payload)
  return data
}

export const cancelChatTask = async (taskId: string) => {
  const { data } = await apiClient.post<{ taskId: string; status: string }>(
    `/chat/tasks/${taskId}/cancel`
  )
  return data
}

export const retryAssistantMessage = async (assistantMessageId: string) => {
  const { data } = await apiClient.post<{
    taskId: string
    assistantMessageId: string
  }>(`/chat/messages/${assistantMessageId}/retry`)
  return data
}

export const continueAssistantMessage = async (assistantMessageId: string) => {
  const { data } = await apiClient.post<{
    taskId: string
    assistantMessageId: string
  }>(`/chat/messages/${assistantMessageId}/continue`)
  return data
}
