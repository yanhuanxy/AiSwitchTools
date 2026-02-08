import { Injectable, Inject } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

type GenerationTaskStatusType =
  | 'pending'
  | 'running'
  | 'completed'
  | 'canceled'
  | 'failed';
type MessageStatusType =
  | 'sent'
  | 'generating'
  | 'completed'
  | 'failed'
  | 'canceled';

@Injectable()
export class TasksRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async findTaskWithConversation(taskId: string, ownerUserId: string) {
    return this.prisma.generationTask.findFirst({
      where: {
        id: taskId,
        conversation: {
          ownerUserId,
        },
      },
      include: {
        conversation: true,
      },
    });
  }

  async findMessageById(messageId: string, ownerUserId: string) {
    return this.prisma.message.findFirst({
      where: {
        id: messageId,
        ownerUserId,
      },
    });
  }

  async updateTaskStatus(params: {
    taskId: string;
    status: GenerationTaskStatusType;
    errorCode?: string | null;
    errorMessage?: string | null;
    tokenUsagePrompt?: number;
    tokenUsageCompletion?: number;
    tokenUsageTotal?: number;
  }) {
    const data: any = {
      status: params.status,
      errorCode: params.errorCode ?? null,
      errorMessage: params.errorMessage ?? null,
    };
    if (params.tokenUsagePrompt !== undefined) data.tokenUsagePrompt = params.tokenUsagePrompt;
    if (params.tokenUsageCompletion !== undefined) data.tokenUsageCompletion = params.tokenUsageCompletion;
    if (params.tokenUsageTotal !== undefined) data.tokenUsageTotal = params.tokenUsageTotal;

    return this.prisma.generationTask.update({
      where: { id: params.taskId },
      data,
    });
  }

  async updateMessageContent(messageId: string, content: string) {
    return this.prisma.message.update({
      where: { id: messageId },
      data: { content },
    });
  }

  async updateMessageStatus(params: {
    messageId: string;
    status: MessageStatusType;
    partial: boolean;
  }) {
    return this.prisma.message.update({
      where: { id: params.messageId },
      data: { status: params.status, partial: params.partial },
    });
  }
}
