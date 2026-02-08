import { Injectable, NotFoundException, ConflictException, Inject } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ulid } from 'ulid';

interface CharacterVersionInfo {
  id: string;
  version: number;
}

@Injectable()
export class ConversationsProvider {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  /**
   * 获取角色的最新可用版本
   * 1. 优先选择已发布的版本
   * 2. 如果没有已发布版本，选择草稿版本
   * 3. 如果角色不存在或没有版本，抛出异常
   */
  async getLatestCharacterVersion(characterId: string, ownerUserId: string): Promise<CharacterVersionInfo> {
    // 首先检查角色是否存在且属于当前用户
    const character = await this.prisma.character.findFirst({
      where: {
        id: characterId,
        ownerUserId,
      },
    });

    if (!character) {
      throw new NotFoundException(`Character ${characterId} not found`);
    }

    // 优先查找已发布的版本
    const publishedVersion = await this.prisma.characterVersion.findFirst({
      where: {
        characterId,
        status: 'published',
      },
      orderBy: [
        { version: 'desc' },
        { createdAt: 'desc' },
      ],
      select: {
        id: true,
        version: true,
      },
    });

    if (publishedVersion) {
      return publishedVersion;
    }

    // 如果没有已发布版本，查找草稿版本
    const draftVersion = await this.prisma.characterVersion.findFirst({
      where: {
        characterId,
        status: 'draft',
      },
      orderBy: [
        { version: 'desc' },
        { createdAt: 'desc' },
      ],
      select: {
        id: true,
        version: true,
      },
    });

    if (draftVersion) {
      return draftVersion;
    }

    throw new NotFoundException(`No versions found for character ${characterId}`);
  }

  /**
   * 生成会话标题
   * 格式：{角色名称} {MM-DD}
   */
  generateConversationTitle(characterName: string): string {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${characterName} ${month}-${day}`;
  }

  /**
   * 生成会话ID
   */
  generateConversationId(): string {
    return `conv_${ulid()}`;
  }

  /**
   * 验证会话是否属于指定用户
   */
  async validateOwnership(conversationId: string, ownerUserId: string): Promise<boolean> {
    const conversation = await this.prisma.conversation.findFirst({
      where: {
        id: conversationId,
        ownerUserId,
        deletedAt: null,
      },
      select: {
        id: true,
      },
    });

    return !!conversation;
  }
}