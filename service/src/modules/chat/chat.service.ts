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
import { LlmService, ChatMessage } from '../llm/llm.service';
import { TasksRepository } from '../tasks/tasks.repository';

type PromptConfig = {
  backgroundStory?: string;
  personalityTags?: string[];
  speakingStyle?: string;
  fewShotExamples?: Array<{ user: string; assistant: string }>;
  tabooAndBoundaries?: string;
};

@Injectable()
export class ChatService {
  constructor(
    @Inject(ChatRepository) private readonly chatRepository: ChatRepository,
    @Inject(ChatProvider) private readonly chatProvider: ChatProvider,
    @Inject(AttachmentsService) private readonly attachmentsService: AttachmentsService,
    @Inject(SummariesService) private readonly summariesService: SummariesService,
    @Inject(SafetyService) private readonly safetyService: SafetyService,
    @Inject(LlmService) private readonly llmService: LlmService,
    @Inject(TasksRepository) private readonly tasksRepository: TasksRepository,
  ) {}

  async createTask(ownerUserId: string, dto: CreateChatTaskDto): Promise<ChatTaskResult> {
    const rateLimit = this.safetyService.checkRateLimit(ownerUserId, 'POST /api/chat/tasks');
    if (!rateLimit.allowed) {
      throw new HttpException('RATE_LIMITED', HttpStatus.TOO_MANY_REQUESTS);
    }

    if (!dto.conversationId || !dto.clientMessageId || !dto.content) {
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
      content: dto.content,
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

    const passedAttachmentIds = await this.attachmentsService.filterAttachmentsForModel(
      attachmentIds,
      ownerUserId,
    );
    const summaryContent = await this.getSummaryContent(dto.conversationId, ownerUserId);
    const recentMessages = await this.chatRepository.findRecentMessages({
      conversationId: dto.conversationId,
      ownerUserId,
      limit: 20,
    });

    this.buildPrompt({
      systemPrompt: this.chatProvider.getSystemPrompt(),
      promptConfig: this.parsePromptConfig(conversation.characterVersion.promptConfigJson),
      summary: summaryContent,
      recentMessages,
      currentInput: dto.content,
      attachmentIds: passedAttachmentIds,
      replyLength: dto.replyLength,
    });

    const userMessageId = this.chatProvider.generateMessageId();
    const assistantMessageId = this.chatProvider.generateMessageId();
    const taskId = this.chatProvider.generateTaskId();

    await this.chatRepository.createChatTask({
      conversationId: dto.conversationId,
      ownerUserId,
      userMessageId,
      assistantMessageId,
      taskId,
      content: dto.content,
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
      route: 'POST /api/chat/tasks',
      requestHash,
      responseJson: JSON.stringify(response),
      expiresAt: new Date(Date.now() + this.chatProvider.getIdempotencyTtlMs()),
    });

    await this.tryGenerateSummary(dto.conversationId, ownerUserId);

    // Trigger async processing
    this.processTask(taskId, ownerUserId).catch(err => console.error('Background task error', err));

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

    this.processTask(taskId, ownerUserId).catch(err => console.error('Background task error', err));

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

    this.processTask(taskId, ownerUserId).catch(err => console.error('Background task error', err));

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

  private parsePromptConfig(raw: string): PromptConfig | null {
    if (!raw) {
      return null;
    }
    try {
      return JSON.parse(raw) as PromptConfig;
    } catch {
      return null;
    }
  }

  private buildPrompt(params: {
    systemPrompt: string;
    promptConfig: PromptConfig | null;
    summary: string | null;
    recentMessages: Array<{
      role: string;
      content: string;
      status: string;
      supersededByMessageId: string | null;
    }>;
    currentInput: string;
    attachmentIds: string[];
    replyLength?: string;
  }) {
    const items: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [];

    if (params.systemPrompt) {
      items.push({ role: 'system', content: params.systemPrompt });
    }
    if (params.replyLength) {
      items.push({ role: 'system', content: `Reply length: ${params.replyLength}` });
    }

    const config = params.promptConfig;
    if (config?.backgroundStory) {
      items.push({ role: 'system', content: config.backgroundStory });
    }
    if (config?.personalityTags?.length) {
      items.push({
        role: 'system',
        content: `Personality tags: ${config.personalityTags.join(', ')}`,
      });
    }
    if (config?.speakingStyle) {
      items.push({ role: 'system', content: config.speakingStyle });
    }
    if (config?.tabooAndBoundaries) {
      items.push({ role: 'system', content: config.tabooAndBoundaries });
    }
    if (config?.fewShotExamples?.length) {
      for (const example of config.fewShotExamples) {
        if (example.user) {
          items.push({ role: 'user', content: example.user });
        }
        if (example.assistant) {
          items.push({ role: 'assistant', content: example.assistant });
        }
      }
    }
    if (params.summary) {
      items.push({ role: 'system', content: params.summary });
    }

    const ordered = [...params.recentMessages].reverse();
    for (const message of ordered) {
      if (message.supersededByMessageId) {
        continue;
      }
      if (message.role === 'user' && message.status !== 'sent') {
        continue;
      }
      if (
        message.role === 'assistant' &&
        !['completed', 'failed', 'canceled'].includes(message.status)
      ) {
        continue;
      }
      const role = message.role === 'assistant' ? 'assistant' : 'user';
      items.push({ role, content: message.content });
    }

    let input = params.currentInput;
    if (params.attachmentIds.length > 0) {
      input = `${input}\n[attachments: ${params.attachmentIds.join(', ')}]`;
    }
    items.push({ role: 'user', content: input });

    return items;
  }

  private async getSummaryContent(conversationId: string, ownerUserId: string) {
    try {
      const summary = await this.summariesService.getSummary(conversationId, ownerUserId);
      return summary.content;
    } catch {
      return null;
    }
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

  private async processTask(taskId: string, ownerUserId: string) {
    try {
      const task = await this.tasksRepository.findTaskWithConversation(taskId, ownerUserId);
      if (!task) return;

      const conversation = await this.chatRepository.findConversationContext({
        id: task.conversationId,
        ownerUserId,
      });
      if (!conversation) {
        await this.tasksRepository.updateTaskStatus({
          taskId,
          status: 'failed',
          errorMessage: 'Conversation not found',
        });
        return;
      }

      const summaryContent = await this.getSummaryContent(task.conversationId, ownerUserId);
      const recentMessages = await this.chatRepository.findRecentMessages({
        conversationId: task.conversationId,
        ownerUserId,
        limit: 50,
      });

      const messagesForLlm: ChatMessage[] = [];
      const systemPrompt = this.chatProvider.getSystemPrompt();
      if (systemPrompt) {
        messagesForLlm.push({ role: 'system', content: systemPrompt });
      }

      const config = this.parsePromptConfig(conversation.characterVersion.promptConfigJson);
      if (config) {
        if (config.backgroundStory) {
          messagesForLlm.push({ role: 'system', content: config.backgroundStory });
        }
        if (config.personalityTags?.length) {
          messagesForLlm.push({
            role: 'system',
            content: `Personality tags: ${config.personalityTags.join(', ')}`,
          });
        }
        if (config.speakingStyle) {
          messagesForLlm.push({ role: 'system', content: config.speakingStyle });
        }
        if (config.tabooAndBoundaries) {
          messagesForLlm.push({ role: 'system', content: config.tabooAndBoundaries });
        }
        if (config.fewShotExamples?.length) {
          for (const example of config.fewShotExamples) {
            if (example.user) messagesForLlm.push({ role: 'user', content: example.user });
            if (example.assistant) messagesForLlm.push({ role: 'assistant', content: example.assistant });
          }
        }
      }

      if (summaryContent) {
        messagesForLlm.push({ role: 'system', content: summaryContent });
      }

      const history = recentMessages
        .filter((m) => m.id !== task.assistantMessageId)
        .reverse();

      for (const msg of history) {
        let content = msg.content;
        if (msg.attachments?.length) {
          const attIds = msg.attachments.map((a) => a.attachment.id).join(', ');
          content += `\n[attachments: ${attIds}]`;
        }
        messagesForLlm.push({
          role: msg.role as 'user' | 'assistant',
          content,
        });
      }

      await this.tasksRepository.updateTaskStatus({ taskId, status: 'running' });

      const stream = await this.llmService.chatStream(messagesForLlm, {
        model: task.model,
      });

      let fullContent = '';
      let buffer = '';
      let lastUpdate = Date.now();

      for await (const chunk of stream) {
        const content = chunk.content || '';
        if (content) {
          fullContent += content;
          buffer += content;

          if (Date.now() - lastUpdate > 200 || buffer.length > 20) {
            await this.tasksRepository.updateMessageContent(
              task.assistantMessageId,
              fullContent,
            );
            buffer = '';
            lastUpdate = Date.now();
          }
        }
      }

      await this.tasksRepository.updateMessageContent(task.assistantMessageId, fullContent);
      await this.tasksRepository.updateMessageStatus({
        messageId: task.assistantMessageId,
        status: 'completed',
        partial: false,
      });
      await this.tasksRepository.updateTaskStatus({
        taskId,
        status: 'completed',
        tokenUsageCompletion: Math.ceil(fullContent.length / 3),
        tokenUsageTotal: 0, 
      });
    } catch (error) {
      console.error('Task processing failed', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await this.tasksRepository.updateTaskStatus({
        taskId,
        status: 'failed',
        errorMessage,
      });
      const task = await this.tasksRepository.findTaskWithConversation(taskId, ownerUserId);
      if (task) {
        await this.tasksRepository.updateMessageStatus({
          messageId: task.assistantMessageId,
          status: 'failed',
          partial: true,
        });
      }
    }
  }
}
