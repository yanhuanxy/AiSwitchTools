import { Injectable, Inject } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SummaryEntity, SummaryWithConversation } from './entities';

@Injectable()
export class SummariesRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async create(data: {
    id: string;
    conversationId: string;
    content: string;
  }): Promise<SummaryEntity> {
    return this.prisma.conversationSummary.create({
      data,
    });
  }

  async findById(id: string): Promise<SummaryEntity | null> {
    return this.prisma.conversationSummary.findUnique({
      where: { id },
    });
  }

  async findByConversationId(conversationId: string): Promise<SummaryEntity | null> {
    return this.prisma.conversationSummary.findUnique({
      where: { conversationId },
    });
  }

  async findByConversationIdAndOwner(
    conversationId: string,
    ownerUserId: string,
  ): Promise<SummaryWithConversation | null> {
    return this.prisma.conversationSummary.findFirst({
      where: {
        conversationId,
        conversation: {
          ownerUserId,
        },
      },
      include: {
        conversation: {
          select: {
            id: true,
            title: true,
            ownerUserId: true,
          },
        },
      },
    });
  }

  async update(id: string, content: string): Promise<SummaryEntity> {
    return this.prisma.conversationSummary.update({
      where: { id },
      data: {
        content,
        updatedAt: new Date(),
      },
    });
  }

  async updateByConversationId(
    conversationId: string,
    content: string,
  ): Promise<SummaryEntity> {
    return this.prisma.conversationSummary.upsert({
      where: { conversationId },
      update: {
        content,
        updatedAt: new Date(),
      },
      create: {
        id: `sum_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        conversationId,
        content,
      },
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.conversationSummary.delete({
      where: { id },
    });
  }

  async deleteByConversationId(conversationId: string): Promise<void> {
    await this.prisma.conversationSummary.deleteMany({
      where: { conversationId },
    });
  }

  async exists(id: string): Promise<boolean> {
    const count = await this.prisma.conversationSummary.count({
      where: { id },
    });
    return count > 0;
  }

  async existsByConversationId(conversationId: string): Promise<boolean> {
    const count = await this.prisma.conversationSummary.count({
      where: { conversationId },
    });
    return count > 0;
  }

  async findByOwner(
    ownerUserId: string,
    cursor?: string,
    limit: number = 20,
  ): Promise<{
    items: SummaryWithConversation[];
    nextCursor?: string;
  }> {
    const where = {
      conversation: {
        ownerUserId,
      },
    };

    const summaries = await this.prisma.conversationSummary.findMany({
      where,
      orderBy: [
        { updatedAt: 'desc' },
        { id: 'desc' },
      ],
      take: limit + 1,
      cursor: cursor ? { id: cursor } : undefined,
      skip: cursor ? 1 : 0,
      include: {
        conversation: {
          select: {
            id: true,
            title: true,
            ownerUserId: true,
          },
        },
      },
    });

    const hasMore = summaries.length > limit;
    const items = hasMore ? summaries.slice(0, limit) : summaries;
    const nextCursor = hasMore ? items[items.length - 1].id : undefined;

    return {
      items,
      nextCursor,
    };
  }

  async findNeedingSummary(
    ownerUserId: string,
    minMessageCount: number = 10,
    minTokenCount: number = 4000,
  ): Promise<{
    conversationId: string;
    messageCount: number;
    totalTokens: number;
    lastMessageAt: Date;
  }[]> {
    // 查询需要摘要的会话
    const result = await this.prisma.$queryRaw<Array<{
      conversationId: string;
      messageCount: bigint;
      totalTokens: bigint;
      lastMessageAt: Date;
    }>>`
      SELECT
        c.id as conversationId,
        COUNT(m.id) as messageCount,
        COALESCE(SUM(m.token_count), 0) as totalTokens,
        MAX(m.createdAt) as lastMessageAt
      FROM conversations c
      LEFT JOIN messages m ON c.id = m.conversationId
      LEFT JOIN conversation_summaries cs ON c.id = cs.conversationId
      WHERE c.ownerUserId = ${ownerUserId}
        AND c.deletedAt IS NULL
        AND cs.id IS NULL
      GROUP BY c.id
      HAVING COUNT(m.id) >= ${minMessageCount}
         OR COALESCE(SUM(m.token_count), 0) >= ${minTokenCount}
      ORDER BY lastMessageAt DESC
      LIMIT 100
    `;

    return result.map((row: {
      conversationId: string;
      messageCount: bigint;
      totalTokens: bigint;
      lastMessageAt: Date;
    }) => ({
      conversationId: row.conversationId,
      messageCount: Number(row.messageCount),
      totalTokens: Number(row.totalTokens),
      lastMessageAt: row.lastMessageAt,
    }));
  }

  async findStaleSummaries(
    olderThanHours: number = 24,
  ): Promise<SummaryWithConversation[]> {
    const cutoffTime = new Date(Date.now() - olderThanHours * 60 * 60 * 1000);

    return this.prisma.conversationSummary.findMany({
      where: {
        updatedAt: { lt: cutoffTime },
      },
      orderBy: { updatedAt: 'asc' },
      take: 100,
      include: {
        conversation: {
          select: {
            id: true,
            title: true,
            ownerUserId: true,
          },
        },
      },
    });
  }

  async getSummaryStats(ownerUserId?: string): Promise<{
    total: number;
    byStatus: {
      hasSummary: number;
      needsSummary: number;
      staleSummary: number;
    };
  }> {
    // 总会话数
    const totalConversations = await this.prisma.conversation.count({
      where: ownerUserId ? { ownerUserId, deletedAt: null } : { deletedAt: null },
    });

    // 有摘要的会话数
    const hasSummaryCount = await this.prisma.conversation.count({
      where: ownerUserId
        ? {
            ownerUserId,
            deletedAt: null,
            summary: { isNot: null }
          }
        : {
            deletedAt: null,
            summary: { isNot: null }
          },
    });

    // 需要摘要的会话数（简化版，实际应该调用findNeedingSummary）
    const needingSummaryCount = await this.prisma.conversation.count({
      where: ownerUserId
        ? {
            ownerUserId,
            deletedAt: null,
            summary: null,
            messages: {
              some: {},
            },
          }
        : {
            deletedAt: null,
            summary: null,
            messages: {
              some: {},
            },
          },
    });

    return {
      total: totalConversations,
      byStatus: {
        hasSummary: hasSummaryCount,
        needsSummary: needingSummaryCount,
        staleSummary: 0, // 简化处理，实际需要调用findStaleSummaries
      },
    };
  }

  async cleanupOrphanedSummaries(): Promise<number> {
    // 清理孤立的摘要（对应的会话已删除）
    const result = await this.prisma.$executeRaw<number>`
      DELETE FROM conversation_summaries
      WHERE conversationId NOT IN (
        SELECT id FROM conversations WHERE deletedAt IS NULL
      )
    `;

    return result;
  }

  async getConversationMessageCount(conversationId: string): Promise<number> {
    return this.prisma.message.count({
      where: { conversationId },
    });
  }

  async getConversationTokenCount(conversationId: string): Promise<number> {
    const result = await this.prisma.$queryRaw<Array<{ totalTokens: bigint }>>`
      SELECT COALESCE(SUM(m.token_count), 0) as totalTokens
      FROM messages m
      WHERE m.conversationId = ${conversationId}
    `;
    const totalTokens = result[0]?.totalTokens ?? 0n;
    return Number(totalTokens);
  }

  async getConversationMessagesForSummary(
    conversationId: string,
    limit: number = 50,
  ): Promise<Array<{
    id: string;
    role: string;
    content: string;
    createdAt: Date;
  }>> {
    return this.prisma.message.findMany({
      where: {
        conversationId,
        status: 'sent', // 只考虑已发送的消息
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        role: true,
        content: true,
        createdAt: true,
      },
    });
  }

  async getConversationsWithoutSummaries(ownerUserId: string): Promise<string[]> {
    const conversations = await this.prisma.conversation.findMany({
      where: {
        ownerUserId,
        deletedAt: null,
        summary: null,
      },
      select: {
        id: true,
      },
    });

    return conversations.map((c: { id: string }) => c.id);
  }

  async getSummariesByConversations(
    conversationIds: string[],
  ): Promise<Map<string, SummaryEntity>> {
    const summaries = await this.prisma.conversationSummary.findMany({
      where: {
        conversationId: { in: conversationIds },
      },
    });

    return new Map(summaries.map((summary: SummaryEntity) => [summary.conversationId, summary]));
  }
}
