
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  HttpException,
  HttpStatus,
  Inject,
} from '@nestjs/common';
import { ChatRepository } from './chat.repository';
import { ChatProvider } from './chat.provider';
import { CreateChatTaskDto } from './dto';
import { ChatContinueResult, ChatRetryResult, ChatTaskResult } from './entities';
import { AttachmentsService } from '../attachments/attachments.service';
import { SummariesService } from '../summaries/summaries.service';
import { SafetyService } from '../safety/safety.service';
import { TasksRepository } from '../tasks/tasks.repository';
import { CHAT_PROCESSOR, IChatProcessor } from './chat.interfaces';
import { AggregateChatProcessor } from './processors/aggregate-chat.processor';

@Injectable()
export class ChatService {
  constructor(
    @Inject(ChatRepository) private readonly chatRepository: ChatRepository,
    @Inject(ChatProvider) private readonly chatProvider: ChatProvider,
    @Inject(AttachmentsService) private readonly attachmentsService: AttachmentsService,
    @Inject(SummariesService) private readonly summariesService: SummariesService,
    @Inject(SafetyService) private readonly safetyService: SafetyService,
    @Inject(TasksRepository) private readonly tasksRepository: TasksRepository,
    @Inject(CHAT_PROCESSOR) private readonly chatProcessor: IChatProcessor,
    @Inject(AggregateChatProcessor) private readonly aggregateChatProcessor: AggregateChatProcessor,
  ) {}

  async createTask(ownerUserId: string, dto: CreateChatTaskDto): Promise<ChatTaskResult> {
    return this.handleCreateTask(
      ownerUserId, 
      dto, 
      'POST /api/chat/tasks', 
      async (taskId, userId) => {
        if (!this.chatProcessor) {
           throw new Error('ChatProcessor is not initialized');
        }
        return this.chatProcessor.process(taskId, userId);
      }
    );
  }

  async createTaskV2(ownerUserId: string, dto: CreateChatTaskDto): Promise<ChatTaskResult> {
    return this.handleCreateTask(
      ownerUserId, 
      dto, 
      'POST /api/chat/completion', 
      async (taskId, userId) => {
        if (!this.aggregateChatProcessor) {
           throw new Error('AggregateChatProcessor is not initialized');
        }
        return this.aggregateChatProcessor.process(taskId, userId);
      }
    );
  }

  private async handleCreateTask(
    ownerUserId: string,
    dto: CreateChatTaskDto,
    route: string,
    processor: (taskId: string, userId: string) => Promise<void>
  ): Promise<ChatTaskResult> {
    const rateLimit = this.safetyService.checkRateLimit(ownerUserId, route);
    if (!rateLimit.allowed) {
      throw new HttpException('RATE_LIMITED', HttpStatus.TOO_MANY_REQUESTS);
    }

    if (!dto.conversationId || !dto.clientMessageId) {
      throw new BadRequestException('INVALID_PARAMS');
    }

    if (!dto.content && (!dto.attachmentIds || dto.attachmentIds.length === 0)) {
      throw new BadRequestException('INVALID_PARAMS');
    }

    const attachmentIds = this.normalizeAttachmentIds(dto.attachmentIds);
    const idempotencyKey = this.chatProvider.buildIdempotencyKey({
      ownerUserId,
      conversationId: dto.conversationId,
      clientMessageId: dto.clientMessageId,
    });
    const requestHash = this.chatProvider.hashPayload({
      conversationId: dto.conversationId,
      clientMessageId: dto.clientMessageId,
      content: dto.content || '',
      attachmentIds: [...attachmentIds].sort(),
      replyLength: dto.replyLength ?? null,
    });

    const idempotency = await this.chatRepository.findIdempotencyRecord(idempotencyKey);
    if (idempotency) {
      if (idempotency.expiresAt <= new Date()) {
        await this.chatRepository.deleteIdempotencyRecord(idempotencyKey);
      } else {
        if (idempotency.requestHash !== requestHash) {
          throw new ConflictException('IDEMPOTENCY_CONFLICT');
        }
        return JSON.parse(idempotency.responseJson) as ChatTaskResult;
      }
    }

    const conversation = await this.chatRepository.findConversationContext({
      id: dto.conversationId,
      ownerUserId,
    });
    if (!conversation) {
      throw new NotFoundException(`Conversation ${dto.conversationId} not found`);
    }

    const ownsAttachments = await this.attachmentsService.validateOwnershipBatch(
      attachmentIds,
      ownerUserId,
    );
    if (!ownsAttachments) {
      throw new BadRequestException('INVALID_PARAMS');
    }

    // Filter attachments is just a check/filter, usually doesn't throw
    await this.attachmentsService.filterAttachmentsForModel(
      attachmentIds,
      ownerUserId,
    );

    const userMessageId = this.chatProvider.generateMessageId();
    const assistantMessageId = this.chatProvider.generateMessageId();
    const taskId = this.chatProvider.generateTaskId();

    await this.chatRepository.createChatTask({
      conversationId: dto.conversationId,
      ownerUserId,
      userMessageId,
      assistantMessageId,
      taskId,
      content: dto.content || '',
      clientMessageId: dto.clientMessageId,
      attachmentIds,
      model: this.chatProvider.getDefaultModel(),
    });

    const response: ChatTaskResult = {
      userMessageId,
      assistantMessageId,
      taskId,
    };

    await this.chatRepository.createIdempotencyRecord({
      key: idempotencyKey,
      ownerUserId,
      route: route,
      requestHash,
      responseJson: JSON.stringify(response),
      expiresAt: new Date(Date.now() + this.chatProvider.getIdempotencyTtlMs()),
    });

    await this.tryGenerateSummary(dto.conversationId, ownerUserId);

    // Trigger async processing
    processor(taskId, ownerUserId).catch(err => console.error('Background task error', err));

    return response;
  }

  async retryMessage(ownerUserId: string, assistantMessageId: string): Promise<ChatRetryResult> {
    if (!assistantMessageId) {
      throw new BadRequestException('INVALID_PARAMS');
    }
    const message = await this.chatRepository.findMessageById({
      id: assistantMessageId,
      ownerUserId,
    });
    if (!message) {
      throw new NotFoundException(`Message ${assistantMessageId} not found`);
    }
    if (message.role !== 'assistant') {
      throw new BadRequestException('INVALID_PARAMS');
    }
    if (['completed', 'failed', 'canceled', 'generating'].indexOf(message.status) === -1) {
      throw new BadRequestException('INVALID_PARAMS');
    }

    const newAssistantMessageId = this.chatProvider.generateMessageId();
    const taskId = this.chatProvider.generateTaskId();

    await this.chatRepository.createAssistantMessage({
      id: newAssistantMessageId,
      conversationId: message.conversationId,
      ownerUserId,
    });
    await this.chatRepository.markMessageSuperseded({
      id: message.id,
      supersededByMessageId: newAssistantMessageId,
    });
    await this.chatRepository.createGenerationTask({
      id: taskId,
      conversationId: message.conversationId,
      assistantMessageId: newAssistantMessageId,
      model: this.chatProvider.getDefaultModel(),
    });

    this.chatProcessor.process(taskId, ownerUserId).catch(err => console.error('Background task error', err));

    return { newAssistantMessageId, taskId };
  }

  async continueMessage(
    ownerUserId: string,
    assistantMessageId: string,
  ): Promise<ChatContinueResult> {
    if (!assistantMessageId) {
      throw new BadRequestException('INVALID_PARAMS');
    }
    const message = await this.chatRepository.findMessageById({
      id: assistantMessageId,
      ownerUserId,
    });
    if (!message) {
      throw new NotFoundException(`Message ${assistantMessageId} not found`);
    }
    if (message.role !== 'assistant') {
      throw new BadRequestException('INVALID_PARAMS');
    }
    if (['completed', 'failed', 'canceled', 'generating'].indexOf(message.status) === -1) {
      throw new BadRequestException('INVALID_PARAMS');
    }

    const taskId = this.chatProvider.generateTaskId();
    await this.chatRepository.markMessageGenerating({ id: message.id });
    await this.chatRepository.createGenerationTask({
      id: taskId,
      conversationId: message.conversationId,
      assistantMessageId: message.id,
      model: this.chatProvider.getDefaultModel(),
    });

    this.chatProcessor.process(taskId, ownerUserId).catch(err => console.error('Background task error', err));

    return { assistantMessageId: message.id, taskId };
  }

  private normalizeAttachmentIds(attachmentIds?: string[]) {
    if (!attachmentIds) {
      return [];
    }
    if (!Array.isArray(attachmentIds)) {
      throw new BadRequestException('INVALID_PARAMS');
    }
    const normalized = attachmentIds.filter((id) => Boolean(id));
    if (normalized.length > 4) {
      throw new BadRequestException('INVALID_PARAMS');
    }
    return normalized;
  }

  private async tryGenerateSummary(conversationId: string, ownerUserId: string) {
    try {
      await this.summariesService.generateSummary(conversationId, ownerUserId);
    } catch (error) {
      if (error instanceof ConflictException || error instanceof NotFoundException) {
        return;
      }
      throw error;
    }
  }
}
