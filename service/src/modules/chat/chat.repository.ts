import { Injectable, Inject } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

type ConversationContext = {
  id: string;
  ownerUserId: string;
  characterId: string;
  characterVersionId: string;
  character: { name: string };
  characterVersion: { 
    promptConfigJson: string;
    workflowId: string | null;
    knowledgeBaseId: string | null;
  };
};

type MessageAttachmentRecord = {
  attachment: {
    id: string;
    scanStatus: string;
  };
};

type MessageRecord = {
  id: string;
  conversationId: string;
  role: string;
  content: string;
  status: string;
  partial: boolean;
  supersededByMessageId: string | null;
  createdAt: Date;
  attachments: MessageAttachmentRecord[];
};

@Injectable()
export class ChatRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async findConversationContext(params: {
    id: string;
    ownerUserId: string;
  }): Promise<ConversationContext | null> {
    return this.prisma.conversation.findFirst({
      where: {
        id: params.id,
        ownerUserId: params.ownerUserId,
        deletedAt: null,
      },
      include: {
        character: { select: { name: true } },
        characterVersion: { 
          select: { 
            promptConfigJson: true,
            workflowId: true,
            knowledgeBaseId: true
          } 
        },
      },
    });
  }

  async findRecentMessages(params: {
    conversationId: string;
    ownerUserId: string;
    limit: number;
  }): Promise<MessageRecord[]> {
    return this.prisma.message.findMany({
      where: {
        conversationId: params.conversationId,
        ownerUserId: params.ownerUserId,
        supersededByMessageId: null,
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: params.limit,
      include: { attachments: { include: { attachment: true } } },
    });
  }

  async findMessageById(params: {
    id: string;
    ownerUserId: string;
  }): Promise<MessageRecord | null> {
    return this.prisma.message.findFirst({
      where: {
        id: params.id,
        ownerUserId: params.ownerUserId,
      },
      include: { attachments: { include: { attachment: true } } },
    });
  }

  async createChatTask(params: {
    conversationId: string;
    ownerUserId: string;
    userMessageId: string;
    assistantMessageId: string;
    taskId: string;
    content: string;
    clientMessageId: string;
    attachmentIds: string[];
    model: string;
  }) {
    await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.message.create({
        data: {
          id: params.userMessageId,
          conversationId: params.conversationId,
          ownerUserId: params.ownerUserId,
          role: 'user',
          content: params.content,
          clientMessageId: params.clientMessageId,
          status: 'sent',
          partial: false,
          attachments: {
            create: params.attachmentIds.map((attachmentId) => ({
              attachmentId,
            })),
          },
        },
      });

      await tx.message.create({
        data: {
          id: params.assistantMessageId,
          conversationId: params.conversationId,
          ownerUserId: params.ownerUserId,
          role: 'assistant',
          content: '',
          status: 'generating',
          partial: true,
        },
      });

      await tx.generationTask.create({
        data: {
          id: params.taskId,
          conversationId: params.conversationId,
          assistantMessageId: params.assistantMessageId,
          status: 'pending',
          model: params.model,
        },
      });

      await tx.conversation.update({
        where: {
          id: params.conversationId,
          ownerUserId: params.ownerUserId,
          deletedAt: null,
        },
        data: {
          lastMessageAt: new Date(),
          updatedAt: new Date(),
        },
      });
    });
  }

  async createAssistantMessage(params: {
    id: string;
    conversationId: string;
    ownerUserId: string;
  }) {
    return this.prisma.message.create({
      data: {
        id: params.id,
        conversationId: params.conversationId,
        ownerUserId: params.ownerUserId,
        role: 'assistant',
        content: '',
        status: 'generating',
        partial: true,
      },
    });
  }

  async createGenerationTask(params: {
    id: string;
    conversationId: string;
    assistantMessageId: string;
    model: string;
  }) {
    return this.prisma.generationTask.create({
      data: {
        id: params.id,
        conversationId: params.conversationId,
        assistantMessageId: params.assistantMessageId,
        status: 'pending',
        model: params.model,
      },
    });
  }

  async markMessageSuperseded(params: { id: string; supersededByMessageId: string }) {
    return this.prisma.message.update({
      where: { id: params.id },
      data: { supersededByMessageId: params.supersededByMessageId },
    });
  }

  async markMessageGenerating(params: { id: string }) {
    return this.prisma.message.update({
      where: { id: params.id },
      data: { status: 'generating', partial: true },
    });
  }

  async findIdempotencyRecord(key: string) {
    return this.prisma.idempotencyRecord.findUnique({ where: { key } });
  }

  async createIdempotencyRecord(params: {
    key: string;
    ownerUserId: string;
    route: string;
    requestHash: string;
    responseJson: string;
    expiresAt: Date;
  }) {
    return this.prisma.idempotencyRecord.create({
      data: {
        key: params.key,
        ownerUserId: params.ownerUserId,
        route: params.route,
        requestHash: params.requestHash,
        responseJson: params.responseJson,
        expiresAt: params.expiresAt,
      },
    });
  }

  async deleteIdempotencyRecord(key: string) {
    await this.prisma.idempotencyRecord.delete({ where: { key } });
  }
}
