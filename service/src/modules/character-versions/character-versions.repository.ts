import { Injectable, Inject } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class CharacterVersionsRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async findCharacter(params: { id: string; ownerUserId: string }) {
    return this.prisma.character.findFirst({
      where: { id: params.id, ownerUserId: params.ownerUserId },
    });
  }

  async getLatestVersionNumber(characterId: string) {
    const record = await this.prisma.characterVersion.findFirst({
      where: { characterId },
      orderBy: { version: 'desc' },
    });
    return record?.version ?? 0;
  }

  async createVersion(params: {
    id: string;
    characterId: string;
    version: number;
    status: 'draft' | 'published';
    promptConfigJson: string;
    workflowId?: string;
    knowledgeBaseId?: string;
  }) {
    return this.prisma.characterVersion.create({
      data: {
        id: params.id,
        characterId: params.characterId,
        version: params.version,
        status: params.status,
        promptConfigJson: params.promptConfigJson,
        workflowId: params.workflowId,
        knowledgeBaseId: params.knowledgeBaseId,
      },
    });
  }

  async listVersions(params: { characterId: string; ownerUserId: string }) {
    return this.prisma.characterVersion.findMany({
      where: {
        characterId: params.characterId,
        character: { ownerUserId: params.ownerUserId },
      },
      orderBy: { version: 'desc' },
      include: {
        workflow: true,
        knowledgeBase: true,
      }
    });
  }

  async findVersionById(params: { id: string; ownerUserId: string }) {
    return this.prisma.characterVersion.findFirst({
      where: { id: params.id, character: { ownerUserId: params.ownerUserId } },
      include: { 
        character: true,
        workflow: true,
        knowledgeBase: true,
      },
    });
  }

  async updateVersion(params: { id: string; promptConfigJson?: string; workflowId?: string; knowledgeBaseId?: string }) {
    const data: any = {};
    if (params.promptConfigJson) data.promptConfigJson = params.promptConfigJson;
    if (params.workflowId !== undefined) data.workflowId = params.workflowId;
    if (params.knowledgeBaseId !== undefined) data.knowledgeBaseId = params.knowledgeBaseId;
    
    return this.prisma.characterVersion.update({
      where: { id: params.id },
      data,
    });
  }

  async publishVersion(id: string) {
    return this.prisma.characterVersion.update({
      where: { id },
      data: { status: 'published' },
    });
  }
}
