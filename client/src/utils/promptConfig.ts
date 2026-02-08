import type { PromptConfig } from "../types"

export const createEmptyPromptConfig = (): PromptConfig => ({
  backgroundStory: "",
  personalityTags: [],
  speakingStyle: "",
  fewShotExamples: [],
  tabooAndBoundaries: ""
})
