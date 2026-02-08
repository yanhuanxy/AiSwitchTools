<template>
  <div class="stack">
    <div class="row">
      <RouterLink to="/roles/create">
        <el-button type="primary">创建角色</el-button>
      </RouterLink>
    </div>
    <div v-if="loading" class="list">
      <el-skeleton v-for="n in 3" :key="n" :rows="3" animated />
    </div>
    <div v-else-if="error" class="card stack">
      <span class="muted">{{ error }}</span>
      <el-button @click="loadRoles">重试加载</el-button>
    </div>
    <div v-else-if="!roles || roles.length === 0" class="card">
      <el-empty description="暂无角色，快去创建一个吧" />
    </div>
    <div v-else class="list">
      <RoleCard v-for="item in roles" :key="item.id" :role="item" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue"
import { useRoleStore } from "../stores/roles"
import RoleCard from "../components/RoleCard.vue"
import { handleError } from "../services/error"

const store = useRoleStore()
const roles = computed(() => store.roles)
const loading = ref(false)
const error = ref<string | null>(null)

const loadRoles = async () => {
  loading.value = true
  error.value = null
  try {
    await store.loadRoles()
  } catch (err: any) {
    error.value = handleError(err, "加载角色失败", "roles.load")
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadRoles()
})
</script>
