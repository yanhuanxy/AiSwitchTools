import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import WorkflowEditorPage from '../pages/WorkflowEditorPage.vue'
import { createPinia, setActivePinia } from 'pinia'
import ElementPlus from 'element-plus'

// Mock API
vi.mock('../services/api', () => ({
  api: {
    get: vi.fn((url) => {
      if (url.includes('/workflows/')) {
        return Promise.resolve({ data: { name: 'Test Workflow', graphData: '{}' } })
      }
      if (url.includes('/llm/models')) {
        return Promise.resolve({ data: [] })
      }
      if (url.includes('/knowledge-bases')) {
        return Promise.resolve({ data: [] })
      }
      if (url.includes('/characters')) {
        // Return structured object format
        return Promise.resolve({ 
            data: { 
                items: [
                    { id: 'role1', name: 'Test Role', visibility: 'private' }
                ],
                nextCursor: null 
            } 
        })
      }
      return Promise.resolve({ data: {} })
    })
  }
}))

describe('WorkflowEditorPage', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('correctly parses role list from structured response', async () => {
    const wrapper = mount(WorkflowEditorPage, {
      global: {
        plugins: [ElementPlus],
        stubs: {
          VueFlow: true,
          Background: true,
          Controls: true,
          MiniMap: true
        }
      }
    })

    // Simulate data loading wait
    await new Promise(r => setTimeout(r, 10))
    await wrapper.vm.$nextTick()
    
    // Verify roles are extracted from data.items
    const vm = wrapper.vm as any
    expect(vm.roles).toHaveLength(1)
    expect(vm.roles[0].id).toBe('role1')
  })

  it('renders without crashing when lists are empty/null', async () => {
    const wrapper = mount(WorkflowEditorPage, {
      global: {
        plugins: [ElementPlus],
        stubs: {
          VueFlow: true,
          Background: true,
          Controls: true,
          MiniMap: true
        }
      }
    })

    expect(wrapper.exists()).toBe(true)
    
    // Simulate data loading
    await wrapper.vm.$nextTick()
    
    // Check if roles/llmModels are handled gracefully (no error thrown)
    // We can inspect internal state if needed, but mainly checking for no crash
    expect((wrapper.vm as any).roles).toEqual([])
  })
})
