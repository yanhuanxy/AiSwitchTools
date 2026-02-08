<template>
  <div class="role-detail-page">
    <div class="stack" v-if="loading">
      <el-card>
        <el-skeleton :rows="3" animated />
      </el-card>
      <el-card>
        <el-skeleton :rows="5" animated />
      </el-card>
    </div>
    <div v-else-if="error" class="stack">
      <el-card class="stack">
        <span class="muted">{{ error }}</span>
        <el-button @click="loadData">重试加载</el-button>
      </el-card>
    </div>
    <div class="stack" v-else-if="role">
      <el-card class="stack">
        <div class="row">
          <strong>{{ role.name }}</strong>
          <el-tag size="small">私有</el-tag>
        </div>
        <div class="muted">{{ role.bio || "暂无简介" }}</div>
        <div class="row">
          <el-button type="primary" @click="startChat">开始对话</el-button>
          <el-button @click="editRole">编辑</el-button>
        </div>
      </el-card>
      <el-card class="stack">
        <strong>版本列表</strong>
        <div v-if="!versions || versions.length === 0">
          <el-empty description="暂无版本，请先发布" />
        </div>
        <div v-else class="list">
          <div v-for="item in versions" :key="item.id" class="row">
            <span>v{{ item.version }}</span>
            <el-tag size="small">{{ item.status }}</el-tag>
            <span class="muted">{{ item.createdAt }}</span>
          </div>
        </div>
      </el-card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue"
import { useRoute, useRouter } from "vue-router"
import { useRoleStore } from "../stores/roles"
import { useConversationStore } from "../stores/conversations"
import { handleError } from "../services/error"

const route = useRoute()
const router = useRouter()
const roleStore = useRoleStore()
const conversationStore = useConversationStore()
const roleId = computed(() => route.params.id as string)
const loading = ref(false)
const error = ref<string | null>(null)

const role = computed(() => roleStore.activeRole)
const versions = computed(() => roleStore.activeVersions)

const loadData = async () => {
  loading.value = true
  error.value = null
  try {
    await roleStore.loadRoleDetail(roleId.value)
  } catch (err: any) {
    error.value = handleError(err, "加载角色详情失败", "role.detail")
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadData()
})

const startChat = async () => {
  try {
    const data = await conversationStore.createConversation(roleId.value)
    router.push(`/chat/${data.conversationId}`)
  } catch (err: any) {
    handleError(err, "创建会话失败", "chat.create")
  }
}

const editRole = () => {
  router.push(`/roles/${roleId.value}/edit`)
}
</script>
