<template>
  <div class="row">
    <el-button :disabled="!canStop" @click="stop">停止</el-button>
    <el-button :disabled="!canRetry" @click="retry">重试</el-button>
    <el-button :disabled="!canContinue" @click="continueTask">继续</el-button>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  canStop: boolean
  canRetry: boolean
  canContinue: boolean
}>()

const emit = defineEmits<{ (e: "stop"): void; (e: "retry"): void; (e: "continue"): void }>()

const stop = () => emit("stop")
const retry = () => emit("retry")
const continueTask = () => emit("continue")
</script>
