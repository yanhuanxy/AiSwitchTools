<template>
  <div class="stack">
    <div class="row">
      <strong>工作流</strong>
      <el-button type="primary" @click="createWorkflow">创建工作流</el-button>
    </div>
    <div v-if="loading" class="list">
      <el-skeleton v-for="n in 3" :key="n" :rows="2" animated />
    </div>
    <div v-else class="list">
      <el-card v-for="item in items" :key="item.id" class="stack">
        <div class="row">
          <strong>{{ item.name }}</strong>
          <el-tag v-if="item.published" type="success" size="small">已发布</el-tag>
          <el-tag v-else type="info" size="small">草稿</el-tag>
        </div>
        <div class="muted">{{ item.description || "暂无描述" }}</div>
        <div class="row">
          <el-button @click="edit(item.id)">编辑</el-button>
          <el-button type="danger" @click="remove(item.id)">删除</el-button>
        </div>
      </el-card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { handleError } from '../services/error'
import { api } from '../services/api'

const router = useRouter()
const items = ref<any[]>([])
const loading = ref(false)

const load = async () => {
  loading.value = true
  try {
    const res = await api.get('/workflows')
    items.value = res.data
  } catch (err: any) {
    handleError(err, '加载工作流失败', 'workflow.list')
  } finally {
    loading.value = false
  }
}

const createWorkflow = async () => {
  const name = window.prompt('请输入工作流名称')
  if (!name) return
  try {
    const res = await api.post('/workflows', { 
      name, 
      graphData: JSON.stringify({ nodes: [], edges: [] }) 
    })
    router.push(`/workflows/${res.data.id}/editor`)
  } catch (err: any) {
    handleError(err, '创建失败', 'workflow.create')
  }
}

const edit = (id: string) => {
  router.push(`/workflows/${id}/editor`)
}

const remove = async (id: string) => {
  if (!window.confirm('确认删除？')) return
  try {
    await api.delete(`/workflows/${id}`)
    await load()
  } catch (err: any) {
    handleError(err, '删除失败', 'workflow.delete')
  }
}

onMounted(load)
</script>
