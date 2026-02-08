<template>
  <div class="app-shell">
    <header class="app-header">
      <strong>Swatch工具箱</strong>
      <el-menu :default-active="activePath" mode="horizontal" router class="app-menu" :ellipsis="false">
        <el-menu-item index="/roles">我的角色</el-menu-item>
        <el-menu-item index="/workflows">工作流</el-menu-item>
        <el-menu-item index="/knowledge-bases">知识库</el-menu-item>
        <el-menu-item index="/history">历史</el-menu-item>
        <el-menu-item index="/auth/bind">绑定账号</el-menu-item>
        <div class="flex-grow" />
        <el-menu-item index="" @click="handleLogout">退出登录</el-menu-item>
      </el-menu>
    </header>
    <main class="app-main">
      <RouterView />
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue"
import { useRoute, useRouter } from "vue-router"
import { useAuthStore } from "./stores/auth"
import { ElMessage } from "element-plus"

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

const activePath = computed(() => route.path)

const handleLogout = async () => {
  await authStore.logout()
  ElMessage.success("已退出登录")
  router.push("/")
}
</script>

<style scoped>
.flex-grow {
  flex-grow: 1;
}
</style>
