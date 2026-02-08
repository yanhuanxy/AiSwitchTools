import { Injectable, Inject } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class MessagesRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async findConversation(params: { id: string; ownerUserId: string }) {
    return this.prisma.conversation.findFirst({
      where: { id: params.id, ownerUserId: params.ownerUserId },
    });
  }

  async listMessages(params: {
    conversationId: string;
    ownerUserId: string;
    limit: number;
    cursor?: { createdAt: Date; id: string };
  }) {
    const cursorCondition = params.cursor
      ? {
          OR: [
            { createdAt: { gt: params.cursor.createdAt } },
            {
              createdAt: params.cursor.createdAt,
              id: { gt: params.cursor.id },
            },
          ],
        }
      : undefined;
    return this.prisma.message.findMany({
      where: {
        conversationId: params.conversationId,
        ownerUserId: params.ownerUserId,
        ...(cursorCondition ? { AND: cursorCondition } : {}),
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: params.limit + 1,
      include: { attachments: { include: { attachment: true } } },
    });
  }

  async findLastCompletedMessage(params: { conversationId: string; ownerUserId: string }) {
    return this.prisma.message.findFirst({
      where: {
        conversationId: params.conversationId,
        ownerUserId: params.ownerUserId,
        supersededByMessageId: null,
        OR: [
          { role: 'user', status: 'sent' },
          { role: 'assistant', status: { in: ['completed', 'failed', 'canceled'] } },
        ],
      },
      orderBy: [
        { createdAt: 'desc' },
        { id: 'desc' },
      ],
      select: {
        content: true,
      },
    });
  }
}
