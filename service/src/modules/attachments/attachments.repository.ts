import { Injectable, Inject } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { MessagesProvider } from '../messages/messages.provider';
import { AttachmentEntity } from './entities';

@Injectable()
export class AttachmentsRepository {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(MessagesProvider) private readonly messagesProvider: MessagesProvider,
  ) {}

  async create(data: {
    id: string;
    ownerUserId: string;
    type: 'image';
    storageKey: string;
    mime: string;
    size: number;
    width?: number;
    height?: number;
  }): Promise<AttachmentEntity> {
    return this.prisma.attachment.create({
      data: {
        ...data,
        scanStatus: 'pending',
      },
    });
  }

  async findById(id: string): Promise<AttachmentEntity | null> {
    return this.prisma.attachment.findUnique({
      where: { id },
    });
  }

  async findByIdAndOwner(id: string, ownerUserId: string): Promise<AttachmentEntity | null> {
    return this.prisma.attachment.findFirst({
      where: {
        id,
        ownerUserId,
      },
    });
  }

  async findByOwner(
    ownerUserId: string,
    cursor?: string,
    limit: number = 20,
  ): Promise<{
    items: AttachmentEntity[];
    nextCursor?: string;
  }> {
    const where = {
      ownerUserId,
    };

    const decodedCursor = cursor ? this.messagesProvider.decodeCursor(cursor) : undefined;
    const attachments = await this.prisma.attachment.findMany({
      where,
      orderBy: [
        { createdAt: 'desc' },
        { id: 'desc' },
      ],
      take: limit + 1,
      cursor: decodedCursor ? { id: decodedCursor.id } : undefined,
      skip: decodedCursor ? 1 : 0,
    });

    const hasMore = attachments.length > limit;
    const items = hasMore ? attachments.slice(0, limit) : attachments;
    const nextCursor = hasMore
      ? this.messagesProvider.encodeCursor({
          createdAt: items[items.length - 1].createdAt,
          id: items[items.length - 1].id,
        })
      : undefined;

    return {
      items,
      nextCursor,
    };
  }

  async updateScanStatus(
    id: string,
    scanStatus: 'pending' | 'passed' | 'rejected' | 'failed',
    metadata?: { width?: number; height?: number },
  ): Promise<AttachmentEntity> {
    const updateData: any = { scanStatus };
    if (metadata?.width) updateData.width = metadata.width;
    if (metadata?.height) updateData.height = metadata.height;

    return this.prisma.attachment.update({
      where: { id },
      data: updateData,
    });
  }

  async isReferenced(id: string): Promise<boolean> {
    const count = await this.prisma.messageAttachment.count({
      where: { attachmentId: id },
    });
    return count > 0;
  }

  async deleteById(id: string): Promise<void> {
    await this.prisma.attachment.delete({
      where: { id },
    });
  }

  async findPendingForScan(): Promise<AttachmentEntity[]> {
    return this.prisma.attachment.findMany({
      where: {
        scanStatus: 'pending',
        createdAt: {
          gte: new Date(Date.now() - 60 * 60 * 1000), // 1小时内创建的
        },
      },
      orderBy: { createdAt: 'asc' },
      take: 100, // 批量处理限制
    });
  }

  async findByIds(ids: string[]): Promise<AttachmentEntity[]> {
    return this.prisma.attachment.findMany({
      where: {
        id: { in: ids },
      },
    });
  }

  async findByIdsAndOwner(ids: string[], ownerUserId: string): Promise<AttachmentEntity[]> {
    return this.prisma.attachment.findMany({
      where: {
        id: { in: ids },
        ownerUserId,
      },
    });
  }

  async exists(id: string, ownerUserId?: string): Promise<boolean> {
    const where: any = { id };
    if (ownerUserId) {
      where.ownerUserId = ownerUserId;
    }

    const count = await this.prisma.attachment.count({ where });
    return count > 0;
  }

  async getScanStats(): Promise<{
    pending: number;
    passed: number;
    rejected: number;
    failed: number;
  }> {
    const stats = await this.prisma.attachment.groupBy({
      by: ['scanStatus'],
      _count: {
        scanStatus: true,
      },
    });

    const result = {
      pending: 0,
      passed: 0,
      rejected: 0,
      failed: 0,
    };

    stats.forEach((stat) => {
      const status = stat.scanStatus;
      if (status in result) {
        result[status as keyof typeof result] = stat._count.scanStatus;
      }
    });

    return result;
  }

  async cleanupFailedAttachments(olderThanHours: number = 24): Promise<number> {
    const cutoffTime = new Date(Date.now() - olderThanHours * 60 * 60 * 1000);

    const result = await this.prisma.attachment.deleteMany({
      where: {
        scanStatus: 'failed',
        createdAt: { lt: cutoffTime },
      },
    });

    return result.count;
  }
}
