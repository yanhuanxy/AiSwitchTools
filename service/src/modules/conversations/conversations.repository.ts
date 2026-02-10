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

    let decodedCursor: { createdAt: Date; id: string; isPinned: boolean } | undefined;
    if (cursor) {
      try {
        const decoded = Buffer.from(cursor, 'base64').toString('utf8');
        const payload = JSON.parse(decoded);
        decodedCursor = {
          createdAt: new Date(payload.createdAt),
          id: payload.id,
          isPinned: payload.isPinned ?? false,
        };
      } catch (e) {
        // Fallback to old cursor format if needed or ignore
      }
    }

    // Sort order: isPinned DESC (true first), updatedAt DESC, id DESC
    // Cursor logic for (isPinned, updatedAt, id) < (c.isPinned, c.updatedAt, c.id)
    // Expanded:
    // (isPinned < c.isPinned) -- false < true
    // OR (isPinned = c.isPinned AND updatedAt < c.updatedAt)
    // OR (isPinned = c.isPinned AND updatedAt = c.updatedAt AND id < c.id)

    const cursorCondition = decodedCursor
      ? {
          OR: [
            // If cursor was pinned (true), we accept unpinned (false)
            ...(decodedCursor.isPinned ? [{ isPinned: false }] : []),
            {
              isPinned: decodedCursor.isPinned,
              updatedAt: { lt: decodedCursor.createdAt },
            },
            {
              isPinned: decodedCursor.isPinned,
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
        { isPinned: 'desc' },
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
    
    let nextCursor: string | undefined;
    if (hasMore) {
      const lastItem = items[items.length - 1];
      const payload = JSON.stringify({
        createdAt: lastItem.updatedAt.toISOString(),
        id: lastItem.id,
        isPinned: (lastItem as any).isPinned, // Type cast if needed until entity updated
      });
      nextCursor = Buffer.from(payload, 'utf8').toString('base64');
    }

    return {
      items,
      nextCursor,
    };
  }

  async togglePin(id: string, ownerUserId: string, isPinned: boolean): Promise<void> {
    await this.prisma.conversation.update({
      where: {
        id,
        ownerUserId,
        deletedAt: null,
      },
      data: {
        isPinned,
        updatedAt: new Date(), // Optional: Should pinning update timestamp? Usually yes for sync but maybe no for sorting if we sort by pinned first anyway. 
        // Actually if we sort by Pinned then UpdatedAt, updating UpdatedAt ensures it stays at top of Pinned section or top of Unpinned section.
        // User requirement: "Pinned items move to top".
        // If multiple pinned items exist, their relative order is updatedAt.
        // So updating updatedAt makes it the "newest pinned item". This is good behavior.
      },
    });
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

  async restore(id: string, ownerUserId: string): Promise<void> {
    await this.prisma.conversation.update({
      where: {
        id,
        ownerUserId,
        deletedAt: { not: null },
      },
      data: {
        deletedAt: null,
        updatedAt: new Date(),
      },
    });
  }

  async batchSoftDelete(ids: string[], ownerUserId: string): Promise<void> {
    await this.prisma.conversation.updateMany({
      where: {
        id: { in: ids },
        ownerUserId,
        deletedAt: null,
      },
      data: {
        deletedAt: new Date(),
        updatedAt: new Date(),
      },
    });
  }

  async batchRestore(ids: string[], ownerUserId: string): Promise<void> {
    await this.prisma.conversation.updateMany({
      where: {
        id: { in: ids },
        ownerUserId,
        deletedAt: { not: null },
      },
      data: {
        deletedAt: null,
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
