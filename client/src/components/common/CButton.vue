<template>
  <button
    :class="[
      'coze-btn',
      variant === 'primary' ? 'coze-btn-primary' : 'coze-btn-secondary',
      size === 'lg' ? 'coze-btn-lg' : size === 'xl' ? 'coze-btn-xl' : '',
      $attrs.class
    ]"
    v-bind="$attrs"
  >
    <slot />
  </button>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  variant?: 'primary' | 'secondary'
  size?: 'md' | 'lg' | 'xl'
}>(), {
  variant: 'primary',
  size: 'md'
})
</script>
