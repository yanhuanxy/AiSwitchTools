<template>
  <div class="workflow-editor">
    <div class="toolbar">
      <strong>{{ workflow?.name }}</strong>
      <div class="flex-grow"></div>
      <el-button @click="save" :loading="saving">保存</el-button>
    </div>
    <div class="canvas-container">
      <VueFlow v-model="elements" :fit-view-on-init="true">
        <Background />
        <Controls />
        <MiniMap />
      </VueFlow>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { VueFlow, useVueFlow } from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import { Controls } from '@vue-flow/controls'
import { MiniMap } from '@vue-flow/minimap'
import '@vue-flow/core/dist/style.css'
import '@vue-flow/core/dist/theme-default.css'
import '@vue-flow/controls/dist/style.css'
import '@vue-flow/minimap/dist/style.css'
import { api } from '../services/api'
import { handleError } from '../services/error'
import { ElMessage } from 'element-plus'

const route = useRoute()
const id = route.params.id as string
const workflow = ref<any>(null)
const elements = ref<any[]>([])
const saving = ref(false)

const { toObject } = useVueFlow()

onMounted(async () => {
  try {
    const res = await api.get(`/workflows/${id}`)
    workflow.value = res.data
    if (res.data.graphData) {
      const graph = JSON.parse(res.data.graphData)
      elements.value = [...(graph.nodes || []), ...(graph.edges || [])]
    }
  } catch (err: any) {
    handleError(err, '加载失败', 'workflow.load')
  }
})

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
</script>

<style scoped>
.workflow-editor {
  height: calc(100vh - 120px);
  display: flex;
  flex-direction: column;
}
.toolbar {
  padding: 10px;
  border-bottom: 1px solid #ddd;
  display: flex;
  align-items: center;
  gap: 10px;
  background: white;
}
.canvas-container {
  flex: 1;
  background: #f0f0f0;
  position: relative;
}
.flex-grow {
  flex-grow: 1;
}
</style>
