export interface CharacterVersionEntity {
  id: string;
  characterId: string;
  version: number;
  status: 'draft' | 'published';
  promptConfig: Record<string, unknown>;
  createdAt: string;
}
