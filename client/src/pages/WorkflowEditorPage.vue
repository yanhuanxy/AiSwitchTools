<template>
  <div class="workflow-editor">
    <div class="toolbar">
      <el-button 
        link 
        @click="goBack" 
        class="mr-2 !text-gray-600 hover:!text-primary" 
        title="返回列表"
      >
        <span class="text-xl">←</span>
      </el-button>
      <strong>{{ workflow?.name }}</strong>
      <div class="flex-grow"></div>
      <el-button 
        v-if="!workflow?.published" 
        type="primary" 
        plain 
        @click="confirmPublish" 
        :loading="publishing"
        style="margin-right: 10px;"
      >
        <span class="mr-1">🚀</span> 发布工作流
      </el-button>
      <el-button @click="save" :loading="saving">保存</el-button>
    </div>
    <div class="editor-body">
      <aside class="palette">
        <div class="palette-header">组件库</div>
        <div 
          class="palette-item" 
          draggable="true" 
          @dragstart="onDragStart($event, 'start')"
          @click="addNodeToCenter('start')"
        >开始节点</div>
        <div 
          class="palette-item" 
          draggable="true" 
          @dragstart="onDragStart($event, 'llm')"
          @click="addNodeToCenter('llm')"
        >大模型节点</div>
        <div 
          class="palette-item" 
          draggable="true" 
          @dragstart="onDragStart($event, 'knowledge-base')"
          @click="addNodeToCenter('knowledge-base')"
        >知识库节点</div>
        <div 
          class="palette-item" 
          draggable="true" 
          @dragstart="onDragStart($event, 'condition')"
          @click="addNodeToCenter('condition')"
        >条件节点</div>
        <div 
          class="palette-item" 
          draggable="true" 
          @dragstart="onDragStart($event, 'end')"
          @click="addNodeToCenter('end')"
        >结束节点</div>
      </aside>

      <div class="canvas-container" @drop="onDrop" @dragover="onDragOver" ref="canvasRef">
        <VueFlow 
          v-model:nodes="nodes"
          v-model:edges="edges"
          :fit-view-on-init="true"
          @node-click="onNodeClick"
          @pane-click="onPaneClick"
          @connect="onConnect"
        >
          <Background />
          <Controls />
          <MiniMap />
        </VueFlow>
      </div>

      <aside class="properties" v-if="selectedNode">
        <div class="palette-header">属性配置</div>
        <div class="prop-form">
          <el-form label-position="top" size="small">
            <el-form-item label="节点ID">
              <el-input v-model="selectedNode.id" disabled />
            </el-form-item>
            <el-form-item label="节点名称">
              <el-input v-model="selectedNode.label" @input="updateNodeLabel" />
            </el-form-item>
            
            <!-- LLM Config -->
            <template v-if="selectedNode.type === 'llm'">
              <el-form-item label="模型">
                <el-select v-model="selectedNode.data.model" placeholder="选择模型">
                  <el-option 
                    v-for="model in (llmModels || [])" 
                    :key="model.modelName || model.id" 
                    :label="model.displayName || model.name" 
                    :value="model.modelName || model.id" 
                  >
                    <span>{{ model.displayName || model.name }}</span>
                    <span class="float-right text-gray-400 text-xs ml-2">{{ model.provider }}</span>
                  </el-option>
                </el-select>
              </el-form-item>
              <el-form-item label="系统提示词 (System Prompt)">
                 <el-input 
                  v-model="selectedNode.data.systemPrompt" 
                  type="textarea" 
                  :rows="3" 
                  placeholder="可选：输入系统级指令，覆盖 Agent 默认设定"
                />
              </el-form-item>
              <el-form-item label="Prompt 模板">
                <el-input 
                  v-model="selectedNode.data.prompt" 
                  type="textarea" 
                  :rows="6" 
                  placeholder="使用 {{variable}} 插值"
                />
              </el-form-item>
            </template>


            <!-- KB Config -->
            <template v-if="selectedNode.type === 'knowledge-base'">
              <el-form-item label="选择知识库">
                <el-select 
                  v-model="selectedNode.data.knowledgeBaseId" 
                  placeholder="选择知识库" 
                  filterable
                  :loading="loadingKbs"
                >
                  <el-option 
                    v-for="kb in (knowledgeBases || [])" 
                    :key="kb.id" 
                    :label="kb.name" 
                    :value="kb.id" 
                  >
                    <span>{{ kb.name }}</span>
                    <span class="float-right text-gray-400 text-xs ml-2">{{ kb.documentCount }} docs</span>
                  </el-option>
                </el-select>
              </el-form-item>
            </template>

            <!-- Condition Config -->
            <template v-if="selectedNode.type === 'condition'">
              <el-form-item label="变量名">
                <el-input v-model="selectedNode.data.variable" placeholder="例如: llm_result" />
              </el-form-item>
              <el-form-item label="操作符">
                <el-select v-model="selectedNode.data.operator">
                  <el-option label="包含" value="contains" />
                  <el-option label="等于" value="equals" />
                  <el-option label="不等于" value="not_equals" />
                </el-select>
              </el-form-item>
              <el-form-item label="目标值">
                <el-input v-model="selectedNode.data.value" placeholder="用于比较的值" />
              </el-form-item>
              <div class="muted" style="font-size: 12px; margin-bottom: 10px;">
                提示: 连接连线时，请使用连线标签 "True" 或 "False" 区分分支。
              </div>
            </template>

             <!-- End Config -->
             <template v-if="selectedNode.type === 'end'">
              <el-form-item label="输出变量">
                <el-input v-model="selectedNode.data.outputVar" placeholder="默认 llm_result" />
              </el-form-item>
            </template>

            <el-form-item>
              <el-button type="danger" @click="deleteNode">删除节点</el-button>
            </el-form-item>
          </el-form>
        </div>
      </aside>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { VueFlow, useVueFlow, Connection } from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import { Controls } from '@vue-flow/controls'
import { MiniMap } from '@vue-flow/minimap'
import '@vue-flow/core/dist/style.css'
import '@vue-flow/core/dist/theme-default.css'
import '@vue-flow/controls/dist/style.css'
import '@vue-flow/minimap/dist/style.css'
import { api } from '../services/api'
import { handleError } from '../services/error'
import { ElMessage, ElMessageBox } from 'element-plus'

const route = useRoute()
const router = useRouter()
const id = route.params.id as string
const workflow = ref<any>(null)
// const elements = ref<any[]>([]) // Removed in favor of nodes/edges refs
const nodes = ref<any[]>([])
const edges = ref<any[]>([])
const saving = ref(false)
const publishing = ref(false)
const selectedNode = ref<any>(null)
const canvasRef = ref<HTMLElement | null>(null)
const llmModels = ref<any[]>([])
const knowledgeBases = ref<any[]>([])
const loadingKbs = ref(false)

const { toObject, addNodes, removeNodes, addEdges, project, viewport } = useVueFlow()

const isMounted = ref(true)

onUnmounted(() => {
  isMounted.value = false
})

onMounted(async () => {
  // Load Workflow
  try {
    const res = await api.get(`/workflows/${id}`)
    if (!isMounted.value) return
    workflow.value = res.data
    if (res.data.graphData) {
      const graph = JSON.parse(res.data.graphData)
      nodes.value = graph.nodes || []
      edges.value = graph.edges || []
    }
  } catch (err: any) {
    if (isMounted.value) {
        handleError(err, '加载失败', 'workflow.load')
    }
  }

  // Load Models
  try {
    const res = await api.get('/llm/models')
    if (isMounted.value) {
        // Backend now returns { models: [...] }
        llmModels.value = res.data.models || res.data
    }
  } catch (err: any) {
    console.error('Failed to load LLM models:', err)
    // Fallback if backend fails
    if (isMounted.value) {
        llmModels.value = [
          { id: '默认', name: '无模型', provider: 'openai' }
        ]
    }
  }

  // Load Knowledge Bases
  try {
    loadingKbs.value = true
    const res = await api.get('/knowledge-bases')
    if (isMounted.value) {
        knowledgeBases.value = res.data
    }
  } catch (err: any) {
    console.error('Failed to load knowledge bases:', err)
  } finally {
    if (isMounted.value) {
        loadingKbs.value = false
    }
  }
  
})

const goBack = () => {
  router.back()
}

const onDragStart = (event: DragEvent, type: string) => {
  if (event.dataTransfer) {
    event.dataTransfer.setData('application/vueflow', type)
    event.dataTransfer.effectAllowed = 'move'
  }
}

const onDragOver = (event: DragEvent) => {
  event.preventDefault()
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'move'
  }
}

const createNode = (type: string, position: { x: number; y: number }) => {
  return {
    id: `node_${Date.now()}`,
    type,
    position,
    label: `${type} Node`,
    data: { label: `${type} Node` },
    // Ensure handles are active by default logic in VueFlow
  }
}

const onDrop = (event: DragEvent) => {
  const type = event.dataTransfer?.getData('application/vueflow')
  if (!type) return

  // Calculate position relative to canvas container
  const bounds = canvasRef.value?.getBoundingClientRect()
  
  let position = { x: 0, y: 0 }
  
  if (bounds) {
     // Project screen coordinates to flow coordinates
     // x = (clientX - bounds.left - viewport.x) / viewport.zoom
     // y = (clientY - bounds.top - viewport.y) / viewport.zoom
     position = project({
       x: event.clientX - bounds.left,
       y: event.clientY - bounds.top
     })
  } else {
     // Fallback
     position = {
       x: event.clientX - 250, 
       y: event.clientY - 100,
     }
  }

  const newNode = createNode(type, position)
  addNodes([newNode])
}

const addNodeToCenter = (type: string) => {
  if (!canvasRef.value) return
  
  const bounds = canvasRef.value.getBoundingClientRect()
  
  // Center of visible area
  const centerScreen = {
    x: bounds.width / 2,
    y: bounds.height * 0.3 // Slightly top (30%) as requested
  }
  
  const position = project(centerScreen)
  
  const newNode = createNode(type, position)
  addNodes([newNode])
  ElMessage.success('节点已添加')
}

const onConnect = (params: Connection) => {
  addEdges([params])
}

const onNodeClick = (e: any) => {
  selectedNode.value = e.node
  if (!selectedNode.value.data) selectedNode.value.data = {}
}


const onPaneClick = () => {
  selectedNode.value = null
}

const updateNodeLabel = (val: string) => {
  if (selectedNode.value) {
    selectedNode.value.data.label = val
  }
}

const deleteNode = () => {
  if (selectedNode.value) {
    removeNodes([selectedNode.value.id])
    selectedNode.value = null
  }
}

const save = async () => {
  saving.value = true
  try {
    const flow = toObject()
    await api.patch(`/workflows/${id}`, {
      graphData: JSON.stringify(flow)
    })
    ElMessage.success('保存成功')
  } catch (err: any) {
    handleError(err, '保存失败', 'workflow.save')
  } finally {
    saving.value = false
  }
}

const confirmPublish = async () => {
  try {
    await ElMessageBox.confirm(
      '确认发布该工作流？发布后草稿将移至已发布列表，且不可再编辑。',
      '发布确认',
      {
        confirmButtonText: '确认发布',
        cancelButtonText: '取消',
        type: 'warning',
      }
    )
    publishWorkflow()
  } catch {
    // User cancelled
  }
}

const publishWorkflow = async () => {
  publishing.value = true
  try {
    // Save first to ensure latest changes are published
    await save()
    
    const res = await api.post(`/workflows/${id}/publish`)
    ElMessage.success('发布成功')
    
    // Update local state or redirect
    workflow.value.published = true
    
    // Redirect to list or stay? Requirement says: "自动跳转至已发布面板，高亮显示刚发布的工作流"
    // Assuming list page has tabs. We'll redirect to list.
    router.push('/workflows?tab=published&highlight=' + id)
    
  } catch (err: any) {
    handleError(err, '发布失败，请稍后重试', 'workflow.publish')
  } finally {
    publishing.value = false
  }
}
</script>

<style scoped>
.workflow-editor {
  height: calc(100vh - 60px); /* Adjust for header */
  display: flex;
  flex-direction: column;
}
.toolbar {
  height: 50px;
  padding: 0 20px;
  border-bottom: 1px solid #ddd;
  display: flex;
  align-items: center;
  gap: 10px;
  background: white;
}
.editor-body {
  flex: 1;
  display: flex;
  overflow: hidden;
}
.palette {
  width: 200px;
  border-right: 1px solid #ddd;
  background: #f9f9f9;
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.palette-header {
  font-weight: bold;
  margin-bottom: 5px;
  font-size: 14px;
}
.palette-item {
  padding: 10px;
  background: white;
  border: 1px solid #ddd;
  border-radius: 4px;
  cursor: grab;
  font-size: 13px;
}
.canvas-container {
  flex: 1;
  background: #f0f0f0;
  position: relative;
}
.properties {
  width: 300px;
  border-left: 1px solid #ddd;
  background: white;
  padding: 15px;
  overflow-y: auto;
}
.flex-grow {
  flex-grow: 1;
}
</style>
