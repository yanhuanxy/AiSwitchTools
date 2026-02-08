export interface ChatTaskResult {
  userMessageId: string;
  assistantMessageId: string;
  taskId: string;
}

export interface ChatRetryResult {
  newAssistantMessageId: string;
  taskId: string;
}

export interface ChatContinueResult {
  assistantMessageId: string;
  taskId: string;
}
