
export interface IChatProcessor {
  process(taskId: string, ownerUserId: string): Promise<void>;
}

export const CHAT_PROCESSOR = 'CHAT_PROCESSOR';
