import { Injectable, NotFoundException, ForbiddenException, ConflictException, Inject } from '@nestjs/common';
import { ConversationsRepository } from './conversations.repository';
import { ConversationsProvider } from './conversations.provider';
import { CreateConversationDto, UpdateConversationDto } from './dto';
import { ConversationEntity } from './entities';
import { MessagesRepository } from '../messages/messages.repository';

export interface ConversationResponse {
  conversationId: string;
  characterVersionId: string;
  title?: string | null;
  isPinned: boolean;
  updatedAt: Date;
  lastMessagePreview?: string;
  lastMessageAt?: Date | null;
}

export interface ConversationListResponse {
  items: ConversationResponse[];
  nextCursor?: string;
}

@Injectable()
export class ConversationsService {
  constructor(
    @Inject(ConversationsRepository) private readonly conversationsRepository: ConversationsRepository,
    @Inject(ConversationsProvider) private readonly conversationsProvider: ConversationsProvider,
    @Inject(MessagesRepository) private readonly messagesRepository: MessagesRepository,
  ) {}

  async create(
    ownerUserId: string,
    createDto: CreateConversationDto,
  ): Promise<{ conversationId: string; characterVersionId: string }> {
    const { characterId } = createDto;

    // 获取角色的最新可用版本
    const characterVersion = await this.conversationsProvider.getLatestCharacterVersion(
      characterId,
      ownerUserId,
    );

    // 获取角色信息以生成标题
    const character = await this.conversationsRepository.findCharacterById(characterId, ownerUserId);
    if (!character) {
      throw new NotFoundException(`Character ${characterId} not found`);
    }

    // 生成会话标题
    const title = this.conversationsProvider.generateConversationTitle(character.name);

    // 创建会话
    const conversationId = this.conversationsProvider.generateConversationId();
    const conversation = await this.conversationsRepository.create({
      id: conversationId,
      ownerUserId,
      characterId,
      characterVersionId: characterVersion.id,
      title,
    });

    return {
      conversationId: conversation.id,
      characterVersionId: conversation.characterVersionId,
    };
  }

  async findAll(
    ownerUserId: string,
    cursor?: string,
    limit: number = 20,
  ): Promise<ConversationListResponse> {
    const { items, nextCursor } = await this.conversationsRepository.findByOwner(
      ownerUserId,
      cursor,
      limit,
    );

    // 获取每个会话的最后消息预览
    const enrichedItems = await Promise.all(
      items.map(async (conversation) => {
        const lastMessagePreview = await this.getLastMessagePreview(conversation.id, ownerUserId);
        return {
          conversationId: conversation.id,
          characterVersionId: conversation.characterVersionId,
          title: conversation.title,
          isPinned: (conversation as any).isPinned,
          updatedAt: conversation.updatedAt,
          lastMessagePreview,
          lastMessageAt: conversation.lastMessageAt,
        };
      }),
    );

    return {
      items: enrichedItems,
      nextCursor,
    };
  }

  async findOne(id: string, ownerUserId: string): Promise<ConversationEntity> {
    const conversation = await this.conversationsRepository.findById(id, ownerUserId);
    if (!conversation) {
      throw new NotFoundException(`Conversation ${id} not found`);
    }
    return conversation;
  }

  async update(
    id: string,
    ownerUserId: string,
    updateDto: UpdateConversationDto,
  ): Promise<{ conversationId: string; title: string }> {
    // 验证会话存在且属于当前用户
    const exists = await this.conversationsRepository.exists(id, ownerUserId);
    if (!exists) {
      throw new NotFoundException(`Conversation ${id} not found`);
    }

    const updated = await this.conversationsRepository.updateTitle(
      id,
      ownerUserId,
      updateDto.title,
    );

    return {
      conversationId: updated.id,
      title: updated.title ?? "",
    };
  }

  async togglePin(id: string, ownerUserId: string, isPinned: boolean): Promise<void> {
    const exists = await this.conversationsRepository.exists(id, ownerUserId);
    if (!exists) {
      throw new NotFoundException(`Conversation ${id} not found`);
    }
    await this.conversationsRepository.togglePin(id, ownerUserId, isPinned);
  }

  async remove(id: string, ownerUserId: string): Promise<void> {
    // 验证会话存在且属于当前用户
    const exists = await this.conversationsRepository.exists(id, ownerUserId);
    if (!exists) {
      throw new NotFoundException(`Conversation ${id} not found`);
    }

    await this.conversationsRepository.softDelete(id, ownerUserId);
  }

  async restore(id: string, ownerUserId: string): Promise<void> {
    // We cannot check exists() because it filters out deleted items
    // So we just try to restore
    await this.conversationsRepository.restore(id, ownerUserId);
  }

  async batchRemove(ids: string[], ownerUserId: string): Promise<void> {
    if (ids.length === 0) return;
    await this.conversationsRepository.batchSoftDelete(ids, ownerUserId);
  }

  async batchRestore(ids: string[], ownerUserId: string): Promise<void> {
    if (ids.length === 0) return;
    await this.conversationsRepository.batchRestore(ids, ownerUserId);
  }

  async updateLastMessageAt(conversationId: string, ownerUserId: string): Promise<void> {
    await this.conversationsRepository.updateLastMessageAt(conversationId, ownerUserId);
  }

  async validateOwnership(conversationId: string, ownerUserId: string): Promise<boolean> {
    return this.conversationsProvider.validateOwnership(conversationId, ownerUserId);
  }

  /**
   * 获取会话的最后消息预览
   * 根据设计文档：取该会话内最后一条"已完成可回放消息"的截断文本
   * user=sent 视为完成；assistant 取终态 completed/failed/canceled 且 supersededByMessageId 为空
   */
  private async getLastMessagePreview(
    conversationId: string,
    ownerUserId: string,
  ): Promise<string | undefined> {
    const message = await this.messagesRepository.findLastCompletedMessage({
      conversationId,
      ownerUserId,
    });
    const content = message?.content?.trim();
    if (!content) {
      return undefined;
    }
    if (content.length <= 100) {
      return content;
    }
    return content.slice(0, 100);
  }

  /**
   * 根据ID查找角色（辅助方法）
   */
  private async findCharacterById(characterId: string, ownerUserId: string) {
    // 这里需要依赖 CharactersRepository，暂时直接查询
    // TODO: 在 CharactersModule 完善后使用依赖注入
    return this.conversationsRepository.findCharacterById(characterId, ownerUserId);
  }
}

// 临时扩展 Repository 方法
declare module './conversations.repository' {
  interface ConversationsRepository {
    findCharacterById(characterId: string, ownerUserId: string): Promise<any>;
  }
}

ConversationsRepository.prototype.findCharacterById = async function(
  this: ConversationsRepository,
  characterId: string,
  ownerUserId: string,
): Promise<any> {
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();

  return prisma.character.findFirst({
    where: {
      id: characterId,
      ownerUserId,
    },
    select: {
      id: true,
      name: true,
    },
  });
};
