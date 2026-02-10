<template>
  <div class="flex items-center gap-1 mr-2">
    <button 
      v-if="canRetry" 
      @click="retry" 
      class="p-1.5 text-gray-500 hover:text-primary hover:bg-primary-light/10 rounded-lg transition-colors text-xs flex items-center gap-1 border border-gray-200 hover:border-primary-light"
      title="重试"
    >
      <span class="text-sm">↺</span>
      <span>重试</span>
    </button>
    <button 
      v-if="canContinue" 
      @click="continueTask" 
      class="p-1.5 text-gray-500 hover:text-primary hover:bg-primary-light/10 rounded-lg transition-colors text-xs flex items-center gap-1 border border-gray-200 hover:border-primary-light"
      title="继续"
    >
      <span class="text-xs">▶</span>
      <span>继续</span>
    </button>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  canRetry: boolean
  canContinue: boolean
}>()

const emit = defineEmits<{ (e: "retry"): void; (e: "continue"): void }>()

const retry = () => emit("retry")
const continueTask = () => emit("continue")
</script>
