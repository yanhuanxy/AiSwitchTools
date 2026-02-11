<template>
  <div class="w-[90%] mx-auto p-4 md:p-6 lg:p-8">
    <!-- Header with Back Button -->
    <div class="flex items-center gap-4 mb-6">
      <button @click="router.back()" class="p-2 rounded-full hover:bg-gray-100 transition-colors text-gray-600">
        ←
      </button>
      <h1 class="text-2xl font-bold text-gray-900">创建角色</h1>
    </div>

    <!-- 
      Layout Analysis:
      - We use a 12-column grid for precise control.
      - On large screens (lg+), sidebar takes 4 columns (33%) or 3 columns (25%).
      - Current: 12-column grid.
        lg: Sidebar (col-span-4) + Content (col-span-8).
        xl: Sidebar (col-span-3) + Content (col-span-9).
    -->
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      <!-- Left Column: Basic Info & Actions -->
      <div class="lg:col-span-4 xl:col-span-3 space-y-6 lg:sticky lg:top-6">
        <CCard>
          <div class="border-b border-gray-100 pb-4 mb-6">
            <h2 class="text-lg font-bold text-gray-900">基本信息</h2>
          </div>
          <div class="space-y-6">
            <div class="space-y-2">
              <label class="block text-sm font-medium text-gray-700">
                角色名称 <span class="text-danger">*</span>
              </label>
              <input 
                v-model="name" 
                class="coze-input w-full" 
                placeholder="给你的角色起个名字"
                maxlength="50"
              />
            </div>
            <div class="space-y-2">
              <label class="block text-sm font-medium text-gray-700">角色简介</label>
              <input 
                v-model="bio" 
                class="coze-input w-full" 
                placeholder="一句话描述这个角色"
                maxlength="100"
              />
            </div>
            
            <div class="pt-4 border-t border-gray-100 space-y-4">
               <div class="space-y-2">
                <label class="block text-sm font-medium text-gray-700">发布状态</label>
                <div class="flex gap-4">
                  <label class="flex items-center gap-2 cursor-pointer">
                    <input type="radio" v-model="status" value="published" class="w-4 h-4 text-primary focus:ring-primary border-gray-300">
                    <span class="text-sm text-gray-700">立即发布</span>
                  </label>
                  <label class="flex items-center gap-2 cursor-pointer">
                    <input type="radio" v-model="status" value="draft" class="w-4 h-4 text-primary focus:ring-primary border-gray-300">
                    <span class="text-sm text-gray-700">存为草稿</span>
                  </label>
                </div>
              </div>

              <div class="flex flex-col gap-3 pt-2">
                <el-tooltip content="保存后将立即生效" placement="top" :show-after="1000">
                  <CButton @click="submit" :disabled="saving" class="w-full justify-center">
                    <span v-if="saving">保存中...</span>
                    <span v-else>保存角色</span>
                  </CButton>
                </el-tooltip>
                <CButton variant="secondary" @click="router.back()" class="w-full justify-center">取消</CButton>
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
                v-model="promptConfig.backgroundStory"
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
                v-model="promptConfig.speakingStyle"
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
                v-model="promptConfig.tabooAndBoundaries"
                rows="3"
                class="coze-input h-auto py-2 w-full resize-y"
                placeholder="绝对不能做的事情或话题"
              ></textarea>
            </div>
          </div>
        </CCard>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue"
import { useRouter } from "vue-router"
import { useRoleStore } from "../../stores/roles"
import { createEmptyPromptConfig } from "../../utils/promptConfig"
import { handleError, notifyError } from "../../services/error"
import CCard from "../../components/common/CCard.vue"
import CButton from "../../components/common/CButton.vue"

const router = useRouter()
const store = useRoleStore()
const name = ref("")
const bio = ref("")
const status = ref<"draft" | "published">("published")
const promptConfig = ref(createEmptyPromptConfig())
const tagText = ref("")
const exampleText = ref("")
const saving = ref(false)

const submit = async () => {
  if (!name.value.trim()) {
    notifyError("请填写角色名称")
    return
  }
  saving.value = true
  try {
    promptConfig.value.personalityTags = tagText.value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
    promptConfig.value.fewShotExamples = exampleText.value
      .split("\n")
      .map((line) => line.split("=>"))
      .filter((pair) => pair.length === 2)
      .map(([user, assistant]) => ({
        user: user.trim(),
        assistant: assistant.trim()
      }))

    const role = await store.createRole({ name: name.value, bio: bio.value })
    await store.createVersion(role.id, {
      status: status.value,
      promptConfig: promptConfig.value
    })
    router.push(`/roles/${role.id}`)
  } catch (error: any) {
    handleError(error, "保存失败", "role.create")
  } finally {
    saving.value = false
  }
}
</script>
