<template>
  <el-card v-if="role && role.id" class="stack">
    <div class="row">
      <strong>{{ role.name }}</strong>
      <el-tag size="small">私有</el-tag>
    </div>
    <div class="muted">{{ role.bio || "暂无简介" }}</div>
    <div class="row">
      <el-button @click="goDetail">详情</el-button>
      <el-button @click="goEdit">编辑</el-button>
    </div>
  </el-card>
</template>

<script setup lang="ts">
import type { Character } from "../types"
import { useRouter } from "vue-router"

const props = defineProps<{ role: Character }>()
const router = useRouter()

const goDetail = () => {
  router.push(`/roles/${props.role.id}`)
}

const goEdit = () => {
  router.push(`/roles/${props.role.id}/edit`)
}
</script>
