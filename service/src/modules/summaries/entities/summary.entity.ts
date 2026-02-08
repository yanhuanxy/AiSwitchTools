export interface SummaryEntity {
  id: string;
  conversationId: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SummaryWithConversation extends SummaryEntity {
  conversation?: {
    id: string;
    title?: string | null;
    ownerUserId: string;
  };
}
