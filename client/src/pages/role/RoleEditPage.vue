<template>
  <div class="w-[90%] mx-auto p-4 md:p-6 lg:p-8">
    <!-- Header with Back Button -->
    <div class="flex items-center gap-4 mb-6">
      <button @click="router.back()" class="p-2 rounded-full hover:bg-gray-100 transition-colors text-gray-600">
        ←
      </button>
      <h1 class="text-2xl font-bold text-gray-900">编辑角色</h1>
    </div>

    <div v-if="role" class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      <!-- Left Column: Basic Info & Actions -->
      <div class="lg:col-span-4 xl:col-span-3 space-y-6 lg:sticky lg:top-6">
        <CCard>
          <div class="border-b border-gray-100 pb-4 mb-6">
            <h2 class="text-lg font-bold text-gray-900">基本信息</h2>
          </div>
          <div class="space-y-6">
            <div class="space-y-2">
              <label class="block text-sm font-medium text-gray-700">
                角色名称
              </label>
              <div class="px-3 py-2 bg-gray-50 rounded-lg text-gray-600 border border-gray-100">
                {{ role.name }}
              </div>
            </div>
            <div class="space-y-2">
              <label class="block text-sm font-medium text-gray-700">角色简介</label>
              <div class="px-3 py-2 bg-gray-50 rounded-lg text-gray-600 border border-gray-100 min-h-[42px]">
                {{ role.bio || "暂无简介" }}
              </div>
            </div>
            
            <div class="pt-4 border-t border-gray-100 space-y-4">
              <div class="flex flex-col gap-3 pt-2">
                <CButton @click="saveDraft" :disabled="saving" variant="secondary" class="w-full justify-center">
                  <span v-if="saving">保存中...</span>
                  <span v-else>保存草稿</span>
                </CButton>
                
                <el-tooltip content="发布后将更新线上版本" placement="top" :show-after="1000">
                  <CButton @click="publishDraft" :disabled="saving" class="w-full justify-center">
                    <span v-if="saving">发布中...</span>
                    <span v-else>发布版本</span>
                  </CButton>
                </el-tooltip>
              </div>
            </div>
          </div>
        </CCard>
      </div>

      <!-- Right Column: Detailed Settings -->
      <div class="lg:col-span-8 xl:col-span-9">
        <CCard>
          <div class="border-b border-gray-100 pb-4 mb-6">
            <h2 class="text-lg font-bold text-gray-900">详细设定</h2>
          </div>
          <div class="space-y-6">
            <div class="space-y-2">
              <label class="block text-sm font-medium text-gray-700">背景故事</label>
              <textarea
                v-model="draftConfig.backgroundStory"
                rows="5"
                class="coze-input h-auto py-2 w-full resize-y min-h-[120px]"
                placeholder="角色的身世背景、经历等详细设定..."
              ></textarea>
            </div>
            
            <div class="space-y-2">
              <label class="block text-sm font-medium text-gray-700">性格标签</label>
              <input 
                v-model="tagText" 
                class="coze-input w-full" 
                placeholder="如：傲娇, 腹黑, 温柔（用逗号分隔）" 
              />
            </div>

            <div class="space-y-2">
              <label class="block text-sm font-medium text-gray-700">说话风格</label>
              <textarea
                v-model="draftConfig.speakingStyle"
                rows="3"
                class="coze-input h-auto py-2 w-full resize-y"
                placeholder="如：使用古风词汇，喜欢用反问句"
              ></textarea>
            </div>

            <div class="space-y-2">
              <label class="block text-sm font-medium text-gray-700">
                对话示例 <span class="text-gray-400 text-xs font-normal">(User => Assistant)</span>
              </label>
              <textarea
                v-model="exampleText"
                rows="5"
                class="coze-input h-auto py-2 w-full resize-y font-mono text-sm bg-gray-50"
                placeholder="你好 => 你好呀，找我有什么事吗？&#10;今天天气不错 => 是啊，很适合出去走走呢。"
              ></textarea>
            </div>

            <div class="space-y-2">
              <label class="block text-sm font-medium text-gray-700">禁忌与边界</label>
              <textarea
                v-model="draftConfig.tabooAndBoundaries"
                rows="3"
                class="coze-input h-auto py-2 w-full resize-y"
                placeholder="绝对不能做的事情或话题"
              ></textarea>
            </div>
          </div>
        </CCard>
      </div>
    </div>
    
    <div v-else class="grid grid-cols-1 lg:grid-cols-12 gap-6">
       <div class="lg:col-span-4 xl:col-span-3">
         <CCard class="h-64 animate-pulse bg-gray-50" />
       </div>
       <div class="lg:col-span-8 xl:col-span-9">
         <CCard class="h-[600px] animate-pulse bg-gray-50" />
       </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue"
import { useRoute, useRouter } from "vue-router"
import { useRoleStore } from "../../stores/roles"
import { createEmptyPromptConfig } from "../../utils/promptConfig"
import { handleError, notifyError } from "../../services/error"
import type { CharacterVersion } from "../../types"
import CCard from "../../components/common/CCard.vue"
import CButton from "../../components/common/CButton.vue"

const route = useRoute()
const router = useRouter()
const store = useRoleStore()
const roleId = computed(() => route.params.id as string)
const saving = ref(false)
const tagText = ref("")
const exampleText = ref("")
const draftConfig = ref(createEmptyPromptConfig())
const draftVersionId = ref<string | null>(null)

const role = computed(() => store.activeRole)
const versions = computed(() => store.activeVersions)

const hydrateDraft = (version?: CharacterVersion | null) => {
    const source = version?.promptConfig || createEmptyPromptConfig()
    draftConfig.value = { ...source }
    tagText.value = source.personalityTags.join(",")
    exampleText.value = source.fewShotExamples
      .map((item) => `${item.user}=>${item.assistant}`)
      .join("\n")
    
    // Only track ID if it's a draft. If it's published, we treat it as a base for a NEW draft.
    if (version && version.status === 'draft') {
      draftVersionId.value = version.id
    } else {
      draftVersionId.value = null
    }
  }

  const upsertDraft = async () => {
    buildConfig()
    if (draftVersionId.value) {
      await store.updateVersion(draftVersionId.value, { promptConfig: draftConfig.value })
      return draftVersionId.value
    } else {
      const data = await store.createVersion(roleId.value, {
        status: "draft",
        promptConfig: draftConfig.value
      })
      draftVersionId.value = data.versionId
      return data.versionId
    }
  }

  onMounted(async () => {
    try {
      await store.loadRoleDetail(roleId.value)
      const draft = versions.value.find((item) => item.status === "draft")
      const latestPublished = [...versions.value]
        .filter((item) => item.status === "published")
        .sort((a, b) => b.version - a.version)[0]
      
      // Prefer draft, then latest published, then null
      hydrateDraft(draft || latestPublished || null)
    } catch (err: any) {
      handleError(err, "加载角色失败", "role.edit.load")
    }
  })

  const buildConfig = () => {
    draftConfig.value.personalityTags = tagText.value
      .split(/[,，]/) // Support both CN/EN commas
      .map((item) => item.trim())
      .filter(Boolean)
    draftConfig.value.fewShotExamples = exampleText.value
      .split("\n")
      .map((line) => line.split("=>"))
      .filter((pair) => pair.length === 2)
      .map(([user, assistant]) => ({
        user: user.trim(),
        assistant: assistant.trim()
      }))
  }

  const saveDraft = async () => {
    saving.value = true
    try {
      await upsertDraft()
      await store.loadRoleDetail(roleId.value)
      notifyError("草稿保存成功", "success")
    } catch (error: any) {
      handleError(error, "保存草稿失败", "role.draft")
    } finally {
      saving.value = false
    }
  }

  const publishDraft = async () => {
    saving.value = true
    try {
      // 1. Ensure latest changes are saved to draft first
      const versionId = await upsertDraft()

      // 2. Publish
      await store.publishVersion(versionId)
      
      // 3. Cleanup and Reload
      draftVersionId.value = null // Reset so next save creates a new draft
      await store.loadRoleDetail(roleId.value)
      
      notifyError("发布成功", "success")
      // Optional: Stay on page or go back. User requirement says "correctly jump to version management page" 
      // but usually staying on edit is fine, or going to detail. 
      // Current code: router.push(`/roles/${roleId.value}`)
      router.push(`/roles/${roleId.value}`)
    } catch (error: any) {
      handleError(error, "发布失败", "role.publish")
    } finally {
      saving.value = false
    }
  }
</script>