import { Injectable, Inject } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { MessagesProvider } from '../messages/messages.provider';
import { ConversationEntity } from './entities';

@Injectable()
export class ConversationsRepository {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(MessagesProvider) private readonly messagesProvider: MessagesProvider,
  ) {}

  async create(data: {
    id: string;
    ownerUserId: string;
    characterId: string;
    characterVersionId: string;
    title?: string;
  }): Promise<ConversationEntity> {
    return this.prisma.conversation.create({
      data,
      include: {
        character: {
          select: {
            name: true,
          },
        },
        characterVersion: {
          select: {
            version: true,
          },
        },
      },
    });
  }

  async findById(id: string, ownerUserId: string): Promise<ConversationEntity | null> {
    return this.prisma.conversation.findFirst({
      where: {
        id,
        ownerUserId,
        deletedAt: null,
      },
      include: {
        character: {
          select: {
            name: true,
          },
        },
        characterVersion: {
          select: {
            version: true,
          },
        },
      },
    });
  }

  async findByOwner(
    ownerUserId: string,
    cursor?: string,
    limit: number = 20,
  ): Promise<{
    items: ConversationEntity[];
    nextCursor?: string;
  }> {
    const where = {
      ownerUserId,
      deletedAt: null,
    };

    const decodedCursor = cursor ? this.messagesProvider.decodeCursor(cursor) : undefined;
    const cursorCondition = decodedCursor
      ? {
          OR: [
            { updatedAt: { lt: decodedCursor.createdAt } },
            {
              updatedAt: decodedCursor.createdAt,
              id: { lt: decodedCursor.id },
            },
          ],
        }
      : undefined;

    const conversations = await this.prisma.conversation.findMany({
      where: {
        ...where,
        ...(cursorCondition ? { AND: cursorCondition } : {}),
      },
      orderBy: [
        { updatedAt: 'desc' },
        { id: 'desc' },
      ],
      take: limit + 1,
      include: {
        character: {
          select: {
            name: true,
          },
        },
        characterVersion: {
          select: {
            version: true,
          },
        },
      },
    });

    const hasMore = conversations.length > limit;
    const items = hasMore ? conversations.slice(0, limit) : conversations;
    const nextCursor = hasMore
      ? this.messagesProvider.encodeCursor({
          createdAt: items[items.length - 1].updatedAt,
          id: items[items.length - 1].id,
        })
      : undefined;

    return {
      items,
      nextCursor,
    };
  }

  async updateTitle(id: string, ownerUserId: string, title: string): Promise<ConversationEntity> {
    return this.prisma.conversation.update({
      where: {
        id,
        ownerUserId,
        deletedAt: null,
      },
      data: {
        title,
        updatedAt: new Date(),
      },
      include: {
        character: {
          select: {
            name: true,
          },
        },
        characterVersion: {
          select: {
            version: true,
          },
        },
      },
    });
  }

  async softDelete(id: string, ownerUserId: string): Promise<void> {
    await this.prisma.conversation.update({
      where: {
        id,
        ownerUserId,
        deletedAt: null,
      },
      data: {
        deletedAt: new Date(),
        updatedAt: new Date(),
      },
    });
  }

  async updateLastMessageAt(id: string, ownerUserId: string): Promise<void> {
    await this.prisma.conversation.update({
      where: {
        id,
        ownerUserId,
        deletedAt: null,
      },
      data: {
        lastMessageAt: new Date(),
        updatedAt: new Date(),
      },
    });
  }

  async exists(id: string, ownerUserId: string): Promise<boolean> {
    const count = await this.prisma.conversation.count({
      where: {
        id,
        ownerUserId,
        deletedAt: null,
      },
    });
    return count > 0;
  }
}
