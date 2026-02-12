
/**
 * @vitest-environment happy-dom
 */
import { mount } from '@vue/test-utils'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import Composer from '../components/Composer.vue'
import { createTestingPinia } from '@pinia/testing'
import { useChatStore } from '../stores/chat'
import { ElMessage } from 'element-plus'

vi.mock('element-plus', () => ({
  ElMessage: {
    success: vi.fn(),
    info: vi.fn()
  }
}))

// Mock ChatImageUploader as it might have complex dependencies
const ChatImageUploader = {
  template: '<div></div>',
  methods: {
    trigger: vi.fn()
  }
}

describe('Composer.vue Agent Mode', () => {
  let wrapper: any
  let chatStore: any

  const createWrapper = () => {
    return mount(Composer, {
      global: {
        plugins: [
          createTestingPinia({
            createSpy: vi.fn,
            initialState: {
              chat: {
                isAgentMode: false
              }
            }
          })
        ],
        components: {
          ChatImageUploader
        }
      },
      props: {
        sending: false
      }
    })
  }

  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('renders agent toggle button', () => {
    wrapper = createWrapper()
    const toggleBtn = wrapper.find('button[title="切换到Agent模式"]')
    expect(toggleBtn.exists()).toBe(true)
  })

  it('toggles agent mode on click', async () => {
    wrapper = createWrapper()
    chatStore = useChatStore()
    const toggleBtn = wrapper.find('button[aria-label="Toggle Agent Mode"]')
    
    await toggleBtn.trigger('click')
    
    expect(chatStore.toggleAgentMode).toHaveBeenCalled()
    // Since we are using a mock store with createSpy, actions are spied but not executed by default unless configured.
    // However, pinia-testing usually stubs actions. 
    // To test the integration with store state, we can manually update state or check if action was called.
    // The component relies on store.isAgentMode for visual feedback.
    
    // Let's simulate state change in store manually for the component to react, 
    // or assume the spy is enough for unit testing the interaction.
    // Ideally we verify the component class changes.
  })

  it('changes style when agent mode is active', async () => {
    // Mount with active state
    wrapper = mount(Composer, {
      global: {
        plugins: [
          createTestingPinia({
            createSpy: vi.fn,
            initialState: {
              chat: { isAgentMode: true }
            }
          })
        ],
        components: { ChatImageUploader }
      }
    })
    
    const container = wrapper.find('.relative.bg-white.border')
    expect(container.classes()).toContain('border-blue-300')
    expect(container.classes()).toContain('ring-blue-100')
    
    const textarea = wrapper.find('textarea')
    expect(textarea.attributes('placeholder')).toContain('Agent将自动规划任务')
  })

  it('handles keyboard shortcut', async () => {
    wrapper = createWrapper()
    chatStore = useChatStore()
    
    const event = new KeyboardEvent('keydown', {
      key: 'a',
      metaKey: true, // Cmd+Shift+A
      shiftKey: true
    })
    
    window.dispatchEvent(event)
    expect(chatStore.toggleAgentMode).toHaveBeenCalled()
  })
})
