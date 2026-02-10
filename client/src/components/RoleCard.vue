<template>
  <div class="bg-white border border-gray-200 rounded-xl p-4 flex gap-4 hover:shadow-md hover:border-primary transition-all duration-200 cursor-pointer group h-full" @click="goDetail">
    <!-- Icon (Left) -->
    <div class="flex-shrink-0">
      <div class="w-14 h-14 rounded-xl bg-gray-100 flex items-center justify-center text-2xl group-hover:bg-primary-light group-hover:text-primary transition-colors">
        {{ role.name.charAt(0) }}
      </div>
    </div>

    <!-- Content (Right) -->
    <div class="flex flex-col flex-1 min-w-0 h-full">
      <!-- Header -->
      <div class="flex justify-between items-start mb-1">
        <h3 class="font-bold text-gray-900 text-base truncate pr-2 group-hover:text-primary transition-colors">
          {{ role.name }}
        </h3>
        <!-- Favorite Button (Visible on Hover or if Favorited) -->
        <button 
          @click.stop="toggleFav"
          class="text-gray-300 hover:text-red-500 transition-colors p-0.5"
          :class="{ 'text-red-500 opacity-100': role.isFavorite, 'opacity-0 group-hover:opacity-100': !role.isFavorite }"
          title="收藏"
        >
          <span v-if="role.isFavorite">❤️</span>
          <span v-else>🤍</span>
        </button>
      </div>

      <!-- Description -->
      <p class="text-xs text-gray-500 line-clamp-2 mb-3 flex-1 h-8 leading-relaxed">
        {{ role.bio || "暂无简介，这个角色很神秘..." }}
      </p>

      <!-- Footer -->
      <div class="flex items-center justify-between mt-auto pt-2 border-t border-gray-50">
        <div class="flex items-center gap-2 text-xs text-gray-400">
          <span class="bg-gray-50 px-1.5 py-0.5 rounded">免费</span>
          <span>1.2k 使用</span>
        </div>
        
        <!-- Actions (Visible on Hover) -->
        <div class="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
           <button 
             class="p-1.5 hover:bg-gray-100 rounded text-gray-400 hover:text-primary transition-colors"
             title="编辑"
             @click.stop="goEdit"
           >
             ✎
           </button>
           <button 
             class="p-1.5 hover:bg-gray-100 rounded text-gray-400 hover:text-primary transition-colors"
             title="详情"
             @click.stop="goDetail"
           >
             →
           </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Character } from "../types"
import { useRouter } from "vue-router"
import { useRoleStore } from "../stores/roles"

const props = defineProps<{ role: Character }>()
const router = useRouter()
const rolesStore = useRoleStore()

const goDetail = () => {
  router.push(`/roles/${props.role.id}`)
}

const goEdit = () => {
  router.push(`/roles/${props.role.id}/edit`)
}

const toggleFav = async () => {
  await rolesStore.toggleFavorite(props.role.id)
}
</script>
