<template>
  <div class="stack" v-if="role">
    <el-card class="stack">
      <template #header>
        <strong>角色信息</strong>
      </template>
      <div class="row">
        <span>{{ role.name }}</span>
        <el-tag size="small">私有</el-tag>
      </div>
      <div class="muted">{{ role.bio || "暂无简介" }}</div>
    </el-card>

    <el-card class="stack">
      <template #header>
        <strong>版本编辑</strong>
      </template>
      <el-form label-position="top">
        <el-form-item label="背景故事">
          <el-input
            v-model="draftConfig.backgroundStory"
            type="textarea"
            :rows="4"
            placeholder="背景故事"
          />
        </el-form-item>
        <el-form-item label="性格标签">
          <el-input v-model="tagText" placeholder="性格标签（逗号分隔）" />
        </el-form-item>
        <el-form-item label="说话风格">
          <el-input
            v-model="draftConfig.speakingStyle"
            type="textarea"
            :rows="2"
            placeholder="说话风格"
          />
        </el-form-item>
        <el-form-item label="对话示例 (user=>assistant)">
          <el-input
            v-model="exampleText"
            type="textarea"
            :rows="4"
            placeholder="示例（每行 user=>assistant）"
          />
        </el-form-item>
        <el-form-item label="禁忌与边界">
          <el-input
            v-model="draftConfig.tabooAndBoundaries"
            type="textarea"
            :rows="2"
            placeholder="禁忌与边界"
          />
        </el-form-item>
        <el-form-item>
          <div class="row">
            <el-button @click="saveDraft" :loading="saving">保存草稿</el-button>
            <el-button type="primary" @click="publishDraft" :loading="saving">发布</el-button>
          </div>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
  <div v-else class="stack">
    <el-card>
      <el-skeleton :rows="3" animated />
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue"
import { useRoute, useRouter } from "vue-router"
import { useRoleStore } from "../stores/roles"
import { createEmptyPromptConfig } from "../utils/promptConfig"
import { getErrorMessage, handleError } from "../services/error"
import type { CharacterVersion } from "../types"

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
  draftVersionId.value = version?.id || null
}

onMounted(async () => {
  try {
    await store.loadRoleDetail(roleId.value)
    const draft = versions.value.find((item) => item.status === "draft")
    const latestPublished = [...versions.value]
      .filter((item) => item.status === "published")
      .sort((a, b) => b.version - a.version)[0]
    hydrateDraft(draft || latestPublished || null)
  } catch (err: any) {
    handleError(err, "加载角色失败", "role.edit.load")
  }
})

const buildConfig = () => {
  draftConfig.value.personalityTags = tagText.value
    .split(",")
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
    buildConfig()
    if (draftVersionId.value) {
      await store.updateVersion(draftVersionId.value, { promptConfig: draftConfig.value })
    } else {
      const data = await store.createVersion(roleId.value, {
        status: "draft",
        promptConfig: draftConfig.value
      })
      draftVersionId.value = data.versionId
    }
    await store.loadRoleDetail(roleId.value)
  } catch (error: any) {
    handleError(error, "保存草稿失败", "role.draft")
  } finally {
    saving.value = false
  }
}

const publishDraft = async () => {
  if (!draftVersionId.value) {
    // 尝试先保存草稿
    try {
      buildConfig()
      const data = await store.createVersion(roleId.value, {
        status: "draft",
        promptConfig: draftConfig.value
      })
      draftVersionId.value = data.versionId
    } catch (error: any) {
      handleError(error, "发布前保存失败", "role.publish.save")
      return
    }
  }
  
  if (!draftVersionId.value) return
  saving.value = true
  try {
    await store.publishVersion(draftVersionId.value)
    await store.loadRoleDetail(roleId.value)
    router.push(`/roles/${roleId.value}`)
  } catch (error: any) {
    handleError(error, "发布失败", "role.publish")
  } finally {
    saving.value = false
  }
}
</script>
