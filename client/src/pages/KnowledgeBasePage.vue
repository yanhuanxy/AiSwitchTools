<template>
  <div class="stack">
    <div class="row">
      <strong>知识库</strong>
      <el-button type="primary" @click="createKB">创建知识库</el-button>
    </div>
    <div v-if="loading" class="list">
      <el-skeleton v-for="n in 3" :key="n" :rows="2" animated />
    </div>
    <div v-else class="list">
      <el-card v-for="item in items" :key="item.id" class="stack">
        <div class="row">
          <strong>{{ item.name }}</strong>
          <el-tag size="small">{{ item.documents?.length || 0 }} 文档</el-tag>
        </div>
        <div class="muted">{{ item.description || "暂无描述" }}</div>
        <div class="row">
          <el-button @click="detail(item.id)">管理文档</el-button>
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
    const res = await api.get('/knowledge-bases')
    items.value = res.data
  } catch (err: any) {
    handleError(err, '加载知识库失败', 'kb.list')
  } finally {
    loading.value = false
  }
}

const createKB = async () => {
  const name = window.prompt('请输入知识库名称')
  if (!name) return
  try {
    await api.post('/knowledge-bases', { name })
    await load()
  } catch (err: any) {
    handleError(err, '创建失败', 'kb.create')
  }
}

const detail = (id: string) => {
  // router.push(`/knowledge-bases/${id}`)
  alert('文档管理功能开发中')
}

const remove = async (id: string) => {
  if (!window.confirm('确认删除？')) return
  try {
    await api.delete(`/knowledge-bases/${id}`)
    await load()
  } catch (err: any) {
    handleError(err, '删除失败', 'kb.delete')
  }
}

onMounted(load)
</script>
