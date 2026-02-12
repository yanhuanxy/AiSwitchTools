
import { Injectable, Inject, Logger } from '@nestjs/common';
import { IChatProcessor } from '../chat.interfaces';
import { TasksRepository } from '../../tasks/tasks.repository';
import { ChatRepository } from '../chat.repository';
import { AggregateService } from '../../aggregate/aggregate.service';

@Injectable()
export class AggregateChatProcessor implements IChatProcessor {
  private readonly logger = new Logger(AggregateChatProcessor.name);

  constructor(
    @Inject(TasksRepository) private readonly tasksRepository: TasksRepository,
    @Inject(ChatRepository) private readonly chatRepository: ChatRepository,
    @Inject(AggregateService) private readonly aggregateService: AggregateService,
  ) {
    if (!this.tasksRepository) {
        this.logger.error('TasksRepository not injected');
        throw new Error('TasksRepository is required');
    }
    if (!this.chatRepository) {
        this.logger.error('ChatRepository not injected');
        throw new Error('ChatRepository is required');
    }
    if (!this.aggregateService) {
        this.logger.error('AggregateService not injected');
        throw new Error('AggregateService is required');
    }
    this.logger.log('AggregateChatProcessor initialized successfully');
  }

  async process(taskId: string, ownerUserId: string): Promise<void> {
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

      const recentMessages = await this.chatRepository.findRecentMessages({
        conversationId: task.conversationId,
        ownerUserId,
        limit: 50,
      });

      const userMessage = recentMessages.find((m) => m.role === 'user');
      const input = userMessage?.content || '';

      await this.tasksRepository.updateTaskStatus({ taskId, status: 'running' });

      // Double check just in case, though constructor guarantees it
      if (!this.aggregateService || typeof this.aggregateService.process !== 'function') {
        throw new Error('AggregateService is not properly initialized');
      }

      // Aggregate Service (Agent Runtime)
      const aggregateResult = await this.aggregateService.process({
        userId: ownerUserId,
        conversationId: task.conversationId,
        input,
        history: recentMessages,
      });

      // Handle result
      let output = '';
      if (aggregateResult && typeof aggregateResult === 'object') {
        if ('content' in aggregateResult && typeof aggregateResult.content === 'string') {
             output = aggregateResult.content;
        } else {
             output = JSON.stringify(aggregateResult);
        }
      } else {
        output = String(aggregateResult);
      }
      
      await this.tasksRepository.updateMessageContent(task.assistantMessageId, output);
      await this.tasksRepository.updateMessageStatus({
        messageId: task.assistantMessageId,
        status: 'completed',
        partial: false,
      });
      await this.tasksRepository.updateTaskStatus({
        taskId,
        status: 'completed',
        tokenUsageCompletion: output.length,
        tokenUsageTotal: 0,
      });

    } catch (error) {
      console.error('Aggregate Task processing failed', error);
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
          partial: false,
        });
      }
    }
  }
}
