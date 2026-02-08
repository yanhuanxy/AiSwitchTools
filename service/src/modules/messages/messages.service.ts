import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
  Optional,
  Inject,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import crypto from 'node:crypto';
import { Request } from 'express';
import { MessagesRepository } from './messages.repository';
import { MessagesProvider } from './messages.provider';

type MessageAttachmentRecord = {
  attachment: {
    id: string;
    scanStatus: string;
    storageKey: string;
    mime: string;
    size: number;
    width: number | null;
    height: number | null;
  };
};

type MessageRecord = {
  id: string;
  role: string;
  content: string;
  status: string;
  partial: boolean;
  supersededByMessageId: string | null;
  createdAt: Date;
  attachments: MessageAttachmentRecord[];
};

@Injectable()
export class MessagesService {
  private readonly signedUrlExpiry: number;

  constructor(
    @Inject(MessagesRepository) private readonly messagesRepository: MessagesRepository,
    @Inject(MessagesProvider) private readonly messagesProvider: MessagesProvider,
    @Optional() @Inject(ConfigService) private readonly configService?: ConfigService,
  ) {
    const signedUrlExpiry = this.getConfigValue('SIGNED_URL_EXPIRY', 3600);
    this.signedUrlExpiry = Number(signedUrlExpiry) || 3600;
  }

  async listMessages(
    request: Request,
    conversationId: string,
    query: { limit?: string; cursor?: string },
  ) {
    const ownerUserId = this.getOwnerUserId(request);
    if (!conversationId) {
      throw new BadRequestException('INVALID_PARAMS');
    }
    const conversation = await this.messagesRepository.findConversation({
      id: conversationId,
      ownerUserId,
    });
    if (!conversation) {
      throw new NotFoundException(`Conversation ${conversationId} not found`);
    }
    const limit = this.parseLimit(query.limit);
    const cursor = query.cursor
      ? this.messagesProvider.decodeCursor(query.cursor)
      : undefined;
    const records = await this.messagesRepository.listMessages({
      conversationId,
      ownerUserId,
      limit,
      cursor,
    });
    const hasMore = records.length > limit;
    const slice = hasMore ? records.slice(0, limit) : records;
    const nextCursor = hasMore
      ? this.messagesProvider.encodeCursor(slice[slice.length - 1])
      : null;
    return {
      items: slice.map((message: MessageRecord) => ({
        id: message.id,
        role: message.role,
        content: message.content,
        status: message.status,
        partial: message.partial,
        supersededByMessageId: message.supersededByMessageId ?? null,
        attachments: message.attachments.map((link: MessageAttachmentRecord) => {
          const attachment = link.attachment;
          const viewUrl = this.buildViewUrl(
            ownerUserId,
            attachment.id,
            attachment.scanStatus
          );
          return {
            attachmentId: attachment.id,
            scanStatus: attachment.scanStatus,
            viewUrl,
            mime: attachment.mime,
            size: attachment.size,
            width: attachment.width ?? undefined,
            height: attachment.height ?? undefined,
          };
        }),
        createdAt: message.createdAt.toISOString(),
      })),
      nextCursor,
    };
  }

  private getOwnerUserId(request: Request) {
    const userId = (request as { user?: { id?: string } }).user?.id;
    if (!userId) {
      throw new UnauthorizedException('AUTH_REQUIRED');
    }
    return userId;
  }

  private parseLimit(raw?: string) {
    if (!raw) {
      return 20;
    }
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      throw new BadRequestException('INVALID_PARAMS');
    }
    return Math.min(Math.floor(parsed), 100);
  }

  private buildViewUrl(ownerUserId: string, attachmentId: string, scanStatus: string) {
    if (scanStatus !== 'passed') {
      return null;
    }
    const token = this.generateDownloadToken(ownerUserId, attachmentId);
    return `/api/attachments/${attachmentId}/download?token=${encodeURIComponent(token)}`;
  }

  private generateDownloadToken(ownerUserId: string, attachmentId: string): string {
    const secret = String(
      this.getConfigValue('ATTACHMENTS_TOKEN_SECRET', 'dev-secret'),
    );
    const payload = {
      ownerUserId,
      attachmentId,
      exp: Math.floor(Date.now() / 1000) + this.signedUrlExpiry,
    };
    const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const sig = crypto.createHmac('sha256', secret).update(data).digest('base64url');
    return `${data}.${sig}`;
  }

  private getConfigValue(key: string, fallback: string | number) {
    const fromService = this.configService?.get(key, fallback);
    if (fromService !== undefined) {
      return fromService;
    }
    const fromEnv = process.env[key];
    return fromEnv ?? fallback;
  }

}
