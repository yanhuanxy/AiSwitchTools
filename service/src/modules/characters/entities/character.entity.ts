export interface CharacterEntity {
  id: string;
  name: string;
  bio?: string;
  avatarAttachmentId?: string;
  visibility: 'private' | 'public';
  createdAt: string;
  updatedAt: string;
}
