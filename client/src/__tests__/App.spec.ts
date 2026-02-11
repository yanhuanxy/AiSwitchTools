import { mount } from '@vue/test-utils'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import App from '../App.vue'
import { createTestingPinia } from '@pinia/testing'
import { useConversationStore } from '../stores/conversations'
import { useAuthStore } from '../stores/auth'
import { useRoleStore } from '../stores/roles'
import { ElMessage, ElMessageBox } from 'element-plus'

// Mock Element Plus components and utilities
vi.mock('element-plus', () => ({
  ElMessage: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn()
  },
  ElMessageBox: {
    confirm: vi.fn(() => Promise.resolve())
  }
}))

// Mock Vue Router
const mockPush = vi.fn()
vi.mock('vue-router', () => ({
  useRoute: () => ({ path: '/' }),
  useRouter: () => ({ push: mockPush }),
  RouterView: { template: '<div><slot /></div>' }
}))

describe('App.vue History Sidebar', () => {
  let wrapper: any
  let conversationStore: any

  const createWrapper = (initialState = {}) => {
    return mount(App, {
      global: {
        plugins: [
          createTestingPinia({
            createSpy: vi.fn,
            initialState: {
              conversations: {
                items: [],
                ...initialState
              },
              auth: { accessToken: 'token' },
              roles: { roles: [] }
            }
          })
        ],
        stubs: {
          'router-link': true,
          'el-dropdown': {
            template: '<div><slot /><slot name="dropdown" /></div>'
          },
          'el-dropdown-menu': {
            template: '<div><slot /></div>'
          },
          'el-dropdown-item': {
            template: '<div @click="$emit(\'command\', command)"><slot /></div>',
            props: ['command']
          },
          'el-image': true,
          'el-tooltip': true,
          'transition': false
        }
      }
    })
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders history items correctly (limit 10)', () => {
    const items = Array.from({ length: 15 }, (_, i) => ({
      conversationId: `id-${i}`,
      title: `Chat ${i}`,
      isPinned: false,
      updatedAt: new Date().toISOString()
    }))
    
    wrapper = createWrapper({ items })
    conversationStore = useConversationStore()
    
    // Check rendered items count
    const renderedItems = wrapper.findAll('.group.relative')
    expect(renderedItems.length).toBe(10)
    
    // Check "View All" link visibility
    const viewAll = wrapper.find('a')
    expect(viewAll.exists()).toBe(true)
    expect(viewAll.text()).toContain('查看全部历史会话')
  })

  it('hides "View All" link when items <= 10', () => {
    const items = Array.from({ length: 8 }, (_, i) => ({
      conversationId: `id-${i}`,
      title: `Chat ${i}`,
      isPinned: false
    }))
    
    wrapper = createWrapper({ items })
    
    const renderedItems = wrapper.findAll('.group.relative')
    expect(renderedItems.length).toBe(8)
    expect(wrapper.find('a').exists()).toBe(false)
  })

  it('shows pinned icon correctly', () => {
    const items = [
      { conversationId: '1', title: 'Pinned', isPinned: true },
      { conversationId: '2', title: 'Normal', isPinned: false }
    ]
    wrapper = createWrapper({ items })
    
    const rows = wrapper.findAll('.group.relative')
    expect(rows[0].text()).toContain('📌')
    expect(rows[1].text()).toContain('💬')
  })

  it('handles pin action', async () => {
    const items = [{ conversationId: '1', title: 'Test', isPinned: false }]
    wrapper = createWrapper({ items })
    conversationStore = useConversationStore()
    
    // Find dropdown item for pin
    // Note: Since we stubbed el-dropdown, we need to simulate the command event
    // But in App.vue, the command event is on el-dropdown, bubbling from item?
    // App.vue: @command="(cmd) => handleHistoryCommand(cmd, conv)" on el-dropdown
    
    // Let's call the handler directly via vm to simplify if DOM structure is complex with stubs
    await wrapper.vm.handleHistoryCommand('pin', items[0])
    
    expect(conversationStore.togglePin).toHaveBeenCalledWith('1', true)
    expect(ElMessage.success).toHaveBeenCalledWith('已置顶')
  })

  it('handles delete action with confirmation', async () => {
    const items = [{ conversationId: '1', title: 'Test', isPinned: false }]
    wrapper = createWrapper({ items })
    conversationStore = useConversationStore()
    
    await wrapper.vm.handleHistoryCommand('delete', items[0])
    
    expect(ElMessageBox.confirm).toHaveBeenCalled()
    expect(conversationStore.deleteConversation).toHaveBeenCalledWith('1')
    expect(ElMessage.success).toHaveBeenCalledWith('删除成功')
  })

  it('navigates to history page when "View All" is clicked', async () => {
    const items = Array.from({ length: 11 }, (_, i) => ({ conversationId: `id-${i}` }))
    wrapper = createWrapper({ items })
    
    await wrapper.find('a').trigger('click')
    
    expect(mockPush).toHaveBeenCalledWith('/history?from=app')
  })
})
