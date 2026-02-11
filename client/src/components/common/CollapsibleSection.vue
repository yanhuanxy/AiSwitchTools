<template>
  <div class="flex flex-col gap-4">
    <button 
      @click="toggle" 
      class="flex items-center gap-2 group w-full text-left"
    >
      <div 
        class="p-1 rounded hover:bg-gray-100 text-gray-400 transition-transform duration-200"
        :class="{ 'rotate-90': isOpen }"
      >
        ▶
      </div>
      <h2 class="text-lg font-bold text-gray-900">{{ title }}</h2>
      <span v-if="count !== undefined" class="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
        {{ count }}
      </span>
      <div class="flex-1 h-px bg-gray-100 ml-2 group-hover:bg-gray-200 transition-colors"></div>
    </button>
    
    <div 
      v-show="isOpen" 
      class="transition-all duration-300 ease-in-out"
    >
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const props = defineProps<{
  title: string
  count?: number
  defaultOpen?: boolean
}>()

const isOpen = ref(props.defaultOpen ?? true)

const toggle = () => {
  isOpen.value = !isOpen.value
}
</script>
