export type Character = {
  id: string
  name: string
  bio?: string
  avatarAttachmentId?: string
  visibility: "private"
  isFavorite?: boolean
  createdAt: string
  updatedAt: string
}

export type PromptConfig = {
  backgroundStory: string
  personalityTags: string[]
  speakingStyle: string
  fewShotExamples: Array<{ user: string; assistant: string }>
  tabooAndBoundaries: string
  safetyTightening?: Record<string, unknown>
}

export type CharacterVersion = {
  id: string
  characterId: string
  version: number
  status: "draft" | "published"
  promptConfig: PromptConfig
  workflowId?: string
  knowledgeBaseId?: string
  createdAt: string
}

export type ConversationListItem = {
  conversationId: string
  title: string
  isPinned: boolean
  updatedAt: string
  lastMessagePreview: string
  characterName?: string
  characterAvatar?: string
}

export type Attachment = {
  attachmentId: string
  scanStatus: "pending" | "passed" | "rejected" | "failed"
  viewUrl?: string
  mime?: string
  size?: number
  width?: number
  height?: number
}

export type Message = {
  id: string
  role: "user" | "assistant"
  content: string
  status?: "sent" | "generating" | "completed" | "failed" | "canceled"
  partial?: boolean
  supersededByMessageId?: string | null
  attachments?: Attachment[]
  createdAt: string
}

export type GenerationTask = {
  taskId: string
  assistantMessageId: string
  status?: "pending" | "running" | "completed" | "canceled" | "failed"
}

export type ApiListResponse<T> = {
  items: T[]
  nextCursor: string | null
}

export type ApiError = {
  code: string
  message: string
  traceId?: string
}

export type AgentState = "IDLE" | "THINKING" | "EXECUTING" | "AWAITING_INPUT";

export type ThoughtLog = {
  text: string;
  timestamp: number;
};

export type ToolCall = {
  tool: string;
  name: string;
  input?: any;
  timestamp: number;
};

export type ToolResult = {
  tool: string;
  status: "success" | "error";
  output: any;
  timestamp: number;
};
