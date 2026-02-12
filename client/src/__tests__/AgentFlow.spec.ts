
/**
 * @vitest-environment happy-dom
 */
import { mount } from '@vue/test-utils'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import ChatPage from '../pages/ChatPage.vue'
import { createTestingPinia } from '@pinia/testing'
import { useChatStore } from '../stores/chat'
import * as chatService from '../services/chat'
import * as sseService from '../services/sse'

// Mock services
vi.mock('../services/chat', () => ({
  createChatTask: vi.fn(),
  createChatCompletion: vi.fn(),
  cancelChatTask: vi.fn(),
  retryAssistantMessage: vi.fn(),
  continueAssistantMessage: vi.fn()
}))

vi.mock('../services/sse', () => ({
  createSseConnection: vi.fn()
}))

vi.mock('vue-router', () => ({
  useRoute: () => ({ params: { conversationId: 'conv_123' } }),
  useRouter: () => ({ push: vi.fn() }),
  createRouter: () => ({ push: vi.fn(), beforeEach: vi.fn() }),
  createWebHistory: vi.fn()
}))

// Mock Element Plus components
const ElDropdown = { template: '<div><slot /><slot name="dropdown" /></div>' }
const ElDropdownMenu = { template: '<div><slot /></div>' }
const ElDropdownItem = { template: '<div class="dropdown-item" @click="$emit(\'click\')"><slot /></div>' }
const ElTag = { template: '<div><slot /></div>' }
const ElDialog = { template: '<div><slot /></div>' }

describe('Agent Flow & Entry Points', () => {
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
                streamTextByAssistantMessageId: {},
                agentStateByConversationId: { 'conv_123': 'IDLE' },
                traceLogsByAssistantMessageId: {}
              },
              conversations: {
                activeConversation: { conversationId: 'conv_123' }
              },
              auth: { accessToken: 'token' }
            }
          })
        ],
        components: {
            'el-dropdown': ElDropdown,
            'el-dropdown-menu': ElDropdownMenu,
            'el-dropdown-item': ElDropdownItem,
            'el-tag': ElTag,
            'el-dialog': ElDialog
        },
        stubs: {
          MessageList: {
            template: '<div class="message-list" :data-debug="showDebugLogs"></div>',
            props: ['showDebugLogs']
          },
          Composer: {
             template: '<div @click="$emit(\'send\', \'Hello\')"></div>'
          },
          TaskControls: true,
          CButton: true
        }
      }
    })
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('uses V2 API for chat completion', async () => {
    wrapper = createWrapper()
    chatStore = useChatStore()

    const mockTaskResponse = {
      taskId: 'task_2',
      userMessageId: 'user_msg_2',
      assistantMessageId: 'asst_msg_2'
    }
    vi.mocked(chatService.createChatCompletion).mockResolvedValue(mockTaskResponse)
    vi.mocked(sseService.createSseConnection).mockReturnValue({ close: vi.fn() })

    // Trigger send
    await wrapper.vm.handleSend('Run Agent')

    expect(chatService.createChatCompletion).toHaveBeenCalledWith(expect.objectContaining({
      conversationId: 'conv_123',
      content: 'Run Agent'
    }))
  })

  it('handles SSE Agent events correctly', async () => {
    wrapper = createWrapper()
    chatStore = useChatStore()
    
    // Simulate SSE connection setup from handleSend
    vi.mocked(chatService.createChatCompletion).mockResolvedValue({
        taskId: 't1', userMessageId: 'u1', assistantMessageId: 'a1'
    })
    
    let sseHandlers: any
    vi.mocked(sseService.createSseConnection).mockImplementation(({ handlers }) => {
        sseHandlers = handlers
        return { close: vi.fn() }
    })

    await wrapper.vm.handleSend('Hello')
    
    // Simulate Agent events
    sseHandlers.onOpen()
    expect(chatStore.setAgentState).toHaveBeenCalledWith('conv_123', 'THINKING')
    
    sseHandlers.onThought({ text: 'Planning...' })
    expect(chatStore.addTraceLog).toHaveBeenCalledWith('a1', expect.objectContaining({
        text: 'Planning...'
    }))

    sseHandlers.onToolUse({ name: 'search', input: { q: 'vue' } })
    expect(chatStore.setAgentState).toHaveBeenCalledWith('conv_123', 'EXECUTING')
    expect(chatStore.addTraceLog).toHaveBeenCalledWith('a1', expect.objectContaining({
        tool: 'workflow',
        name: 'search'
    }))

    sseHandlers.onDelta({ text: 'Result' })
    expect(chatStore.setAgentState).toHaveBeenCalledWith('conv_123', 'IDLE')
  })

  it('toggles debug logs', async () => {
    wrapper = createWrapper()
    // Check if MessageList stub is rendered
    const messageList = wrapper.find('.message-list')
    if (!messageList.exists()) {
        console.log(wrapper.html()) // Debug if failed
    }
    
    expect(wrapper.vm.showDebugLogs).toBe(false)
    
    // Toggle
    await wrapper.vm.toggleDebugLogs()
    expect(wrapper.vm.showDebugLogs).toBe(true)
  })
})
