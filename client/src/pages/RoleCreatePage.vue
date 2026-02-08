<template>
  <div class="stack">
    <el-card class="stack">
      <template #header>
        <strong>创建角色</strong>
      </template>
      <el-form label-position="top">
        <el-form-item label="角色名称" required>
          <el-input v-model="name" placeholder="请输入角色名称" />
        </el-form-item>
        <el-form-item label="角色简介">
          <el-input v-model="bio" placeholder="一句话描述角色" />
        </el-form-item>
      </el-form>
    </el-card>

    <el-card class="stack">
      <template #header>
        <strong>详细设定</strong>
      </template>
      <el-form label-position="top">
        <el-form-item label="背景故事">
          <el-input
            v-model="promptConfig.backgroundStory"
            type="textarea"
            :rows="4"
            placeholder="角色的身世背景、经历等"
          />
        </el-form-item>
        <el-form-item label="性格标签">
          <el-input v-model="tagText" placeholder="如：傲娇, 腹黑, 温柔（用逗号分隔）" />
        </el-form-item>
        <el-form-item label="说话风格">
          <el-input
            v-model="promptConfig.speakingStyle"
            type="textarea"
            :rows="2"
            placeholder="如：使用古风词汇，喜欢用反问句"
          />
        </el-form-item>
        <el-form-item label="对话示例 (user=>assistant)">
          <el-input
            v-model="exampleText"
            type="textarea"
            :rows="4"
            placeholder="你好=>你好呀，找我有什么事吗？"
          />
        </el-form-item>
        <el-form-item label="禁忌与边界">
          <el-input
            v-model="promptConfig.tabooAndBoundaries"
            type="textarea"
            :rows="2"
            placeholder="绝对不能做的事情或话题"
          />
        </el-form-item>
        <el-form-item label="发布状态">
          <el-select v-model="status">
            <el-option label="发布" value="published" />
            <el-option label="草稿" value="draft" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="submit" :loading="saving">保存角色</el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue"
import { useRouter } from "vue-router"
import { useRoleStore } from "../stores/roles"
import { createEmptyPromptConfig } from "../utils/promptConfig"
import { handleError, notifyError } from "../services/error"

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
