import { mount } from '@vue/test-utils'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import ChatPage from '../pages/ChatPage.vue'
import { createTestingPinia } from '@pinia/testing'
import { useChatStore } from '../stores/chat'
import { useConversationStore } from '../stores/conversations'
import { useAuthStore } from '../stores/auth'
import * as chatService from '../services/chat'
import * as sseService from '../services/sse'
import * as attachmentService from '../services/attachments'
import { ElMessage } from 'element-plus'

// Mock services
vi.mock('../services/chat', () => ({
  createChatTask: vi.fn(),
  cancelChatTask: vi.fn(),
  retryAssistantMessage: vi.fn(),
  continueAssistantMessage: vi.fn()
}))

vi.mock('../services/sse', () => ({
  createSseConnection: vi.fn()
}))

vi.mock('../services/attachments', () => ({
  uploadImages: vi.fn()
}))

vi.mock('element-plus', () => ({
  ElMessage: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn()
  }
}))

vi.mock('vue-router', () => ({
  useRoute: () => ({ params: { conversationId: 'conv_123' } }),
  useRouter: () => ({ push: vi.fn() })
}))

describe('ChatPage.vue Message Flow', () => {
  let wrapper: any
  let chatStore: any

  const createWrapper = () => {
    return mount(ChatPage, {
      global: {
        plugins: [
          createTestingPinia({
            createSpy: vi.fn,
            initialState: {
              chat: {
                messagesByConversationId: { 'conv_123': [] },
                streamTextByAssistantMessageId: {}
              },
              conversations: {
                activeConversation: { conversationId: 'conv_123' }
              },
              auth: { accessToken: 'token' }
            }
          })
        ],
        stubs: {
          MessageList: true,
          Composer: {
            template: '<div @click="$emit(\'send\', \'Hello\')"></div>',
            props: ['sending']
          },
          TaskControls: true,
          AttachmentStrip: true,
          CButton: true
        }
      }
    })
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('handles successful message sending flow', async () => {
    wrapper = createWrapper()
    chatStore = useChatStore()
    
    // Mock API responses
    const mockTaskResponse = {
      taskId: 'task_1',
      userMessageId: 'user_msg_1',
      assistantMessageId: 'asst_msg_1'
    }
    vi.mocked(chatService.createChatTask).mockResolvedValue(mockTaskResponse)
    
    // Mock SSE
    const mockSseClose = vi.fn()
    vi.mocked(sseService.createSseConnection).mockReturnValue({ close: mockSseClose })

    // Trigger send
    await wrapper.vm.handleSend('Hello World')

    // 1. Check Optimistic Update
    expect(chatStore.appendMessage).toHaveBeenCalled()
    // We expect optimistic message with client ID
    const appendCall = chatStore.appendMessage.mock.calls[0]
    expect(appendCall[0]).toBe('conv_123')
    expect(appendCall[1].content).toBe('Hello World')
    expect(appendCall[1].status).toBe('sent')

    // 2. Check API Call
    expect(chatService.createChatTask).toHaveBeenCalledWith(expect.objectContaining({
      conversationId: 'conv_123',
      content: 'Hello World'
    }))

    // 3. Check ID Update
    // We expect updateMessage to be called to swap ID
    expect(chatStore.updateMessage).toHaveBeenCalledWith(
      'conv_123', 
      expect.any(String), // clientMsgId
      { id: 'user_msg_1' }
    )

    // 4. Check Assistant Placeholder
    expect(chatStore.appendMessage).toHaveBeenCalledTimes(2) // User msg + Assistant msg
    const asstCall = chatStore.appendMessage.mock.calls[1]
    expect(asstCall[1].role).toBe('assistant')
    expect(asstCall[1].status).toBe('generating')

    // 5. Check SSE Connection
    expect(sseService.createSseConnection).toHaveBeenCalledWith(expect.objectContaining({
      url: '/api/chat/tasks/task_1/events',
      token: 'token'
    }))
  })

  it('handles failed message sending flow', async () => {
    wrapper = createWrapper()
    chatStore = useChatStore()
    
    // Mock API Failure
    vi.mocked(chatService.createChatTask).mockRejectedValue(new Error('Network Error'))

    // Trigger send
    await wrapper.vm.handleSend('Fail Me')

    // 1. Optimistic Update happened
    expect(chatStore.appendMessage).toHaveBeenCalled()

    // 2. API Call happened
    expect(chatService.createChatTask).toHaveBeenCalled()

    // 3. Error Handling
    // Should update message status to failed
    expect(chatStore.updateMessage).toHaveBeenCalledWith(
      'conv_123',
      expect.any(String),
      { status: 'failed' }
    )
    
    // Should show notification (mocked via ElMessage in real code, or notifyError service)
    // notifyError calls ElMessage.error usually
  })
})
