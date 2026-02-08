export interface ConversationEntity {
  id: string;
  ownerUserId: string;
  characterId: string;
  characterVersionId: string;
  title?: string | null;
  lastMessageAt?: Date | null;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
