import { Injectable, NotFoundException, HttpException, HttpStatus, Inject } from '@nestjs/common';
import { Request, Response } from 'express';
import { TasksRepository } from './tasks.repository';
import { TasksProvider } from './tasks.provider';

type GenerationTaskStatusType =
  | 'pending'
  | 'running'
  | 'completed'
  | 'canceled'
  | 'failed';

@Injectable()
export class TasksService {
  private activeConnections: Map<string, number> = new Map();
  private readonly MAX_CONCURRENT_CONNECTIONS = 3;

  constructor(
    @Inject(TasksRepository) private readonly tasksRepository: TasksRepository,
    @Inject(TasksProvider) private readonly tasksProvider: TasksProvider,
  ) {}

  async streamEvents(
    ownerUserId: string,
    taskId: string,
    request: Request,
    response: Response,
  ) {
    const currentConnections = this.activeConnections.get(ownerUserId) || 0;
    if (currentConnections >= this.MAX_CONCURRENT_CONNECTIONS) {
      throw new HttpException('RATE_LIMITED', HttpStatus.TOO_MANY_REQUESTS);
    }
    this.activeConnections.set(ownerUserId, currentConnections + 1);

    try {
      const task = await this.tasksRepository.findTaskWithConversation(
        taskId,
        ownerUserId,
      );
      if (!task) {
        throw new NotFoundException('TASK_NOT_FOUND');
      }
      const assistantMessage = await this.tasksRepository.findMessageById(
        task.assistantMessageId,
        ownerUserId,
      );
      if (!assistantMessage) {
        throw new NotFoundException('MESSAGE_NOT_FOUND');
      }

      const taskStatus = task.status as GenerationTaskStatusType;
      if (taskStatus === 'pending') {
        await this.tasksRepository.updateTaskStatus({
          taskId,
          status: 'running',
        });
      }

      response.setHeader('Content-Type', 'text/event-stream');
      response.setHeader('Cache-Control', 'no-cache');
      response.setHeader('Connection', 'keep-alive');
      if (typeof response.flushHeaders === 'function') {
        response.flushHeaders();
      }

      let closed = false;
      let eventId = 1;
      let lastSentAt = Date.now();
      let lastContent = assistantMessage.content || '';

      const writeEvent = (event: string, data: unknown) => {
        if (closed) {
          return;
        }
        response.write(`id: ${eventId}\n`);
        response.write(`event: ${event}\n`);
        response.write(`data: ${JSON.stringify(data)}\n\n`);
        eventId += 1;
        lastSentAt = Date.now();
      };

      writeEvent('meta', {
        taskId: task.id,
        assistantMessageId: task.assistantMessageId,
        model: task.model,
        resumed: Boolean(request.headers['last-event-id']),
      });

      if (lastContent) {
        writeEvent('delta', { text: lastContent });
      }

      // Define cleanup
      let pollInterval: NodeJS.Timeout | undefined;
      let heartbeatInterval: NodeJS.Timeout | undefined;
      let idleInterval: NodeJS.Timeout | undefined;

      const cleanup = () => {
        if (closed) {
          return;
        }
        closed = true;
        if (pollInterval) clearInterval(pollInterval);
        if (heartbeatInterval) clearInterval(heartbeatInterval);
        if (idleInterval) clearInterval(idleInterval);
        
        const current = this.activeConnections.get(ownerUserId) || 0;
        if (current > 0) {
          this.activeConnections.set(ownerUserId, current - 1);
        }
      };

      if (taskStatus === 'completed' || taskStatus === 'canceled') {
        writeEvent('done', {
          status: taskStatus,
          tokenUsage: {
            prompt: task.tokenUsagePrompt ?? 0,
            completion: task.tokenUsageCompletion ?? 0,
            total: task.tokenUsageTotal ?? 0,
          },
        });
        response.end();
        // Register cleanup to handle decrement on close
        request.on('close', cleanup);
        response.on('close', cleanup);
        return;
      }

      if (taskStatus === 'failed') {
        writeEvent('error', {
          code: task.errorCode ?? 'MODEL_UNAVAILABLE',
          message: task.errorMessage ?? 'Generation failed',
        });
        response.end();
        request.on('close', cleanup);
        response.on('close', cleanup);
        return;
      }

      pollInterval = setInterval(async () => {
        if (closed) {
          return;
        }
        const latestTask = await this.tasksRepository.findTaskWithConversation(
          taskId,
          ownerUserId,
        );
        if (!latestTask) {
          response.end();
          return;
        }
        const latestMessage = await this.tasksRepository.findMessageById(
          latestTask.assistantMessageId,
          ownerUserId,
        );
        if (latestMessage) {
          const content = latestMessage.content || '';
          if (content !== lastContent) {
            const delta = content.startsWith(lastContent)
              ? content.slice(lastContent.length)
              : content;
            if (delta) {
              writeEvent('delta', { text: delta });
            }
            lastContent = content;
          }
        }

        const latestStatus = latestTask.status as GenerationTaskStatusType;
        if (latestStatus === 'completed' || latestStatus === 'canceled') {
          writeEvent('done', {
            status: latestStatus,
            tokenUsage: {
              prompt: latestTask.tokenUsagePrompt ?? 0,
              completion: latestTask.tokenUsageCompletion ?? 0,
              total: latestTask.tokenUsageTotal ?? 0,
            },
          });
          response.end();
        } else if (latestStatus === 'failed') {
          writeEvent('error', {
            code: latestTask.errorCode ?? 'MODEL_UNAVAILABLE',
            message: latestTask.errorMessage ?? 'Generation failed',
          });
          response.end();
        }
      }, this.tasksProvider.getPollIntervalMs());

      heartbeatInterval = setInterval(() => {
        writeEvent('keepalive', {});
      }, this.tasksProvider.getHeartbeatMs());

      idleInterval = setInterval(() => {
        if (Date.now() - lastSentAt > this.tasksProvider.getIdleTimeoutMs()) {
          response.end();
        }
      }, this.tasksProvider.getIdleTimeoutMs());

      request.on('close', cleanup);
      response.on('close', cleanup);

    } catch (error) {
      const current = this.activeConnections.get(ownerUserId) || 0;
      if (current > 0) {
        this.activeConnections.set(ownerUserId, current - 1);
      }
      throw error;
    }
  }

  async cancelTask(ownerUserId: string, taskId: string) {
    const task = await this.tasksRepository.findTaskWithConversation(
      taskId,
      ownerUserId,
    );
    if (!task) {
      throw new NotFoundException('TASK_NOT_FOUND');
    }
    const taskStatus = task.status as GenerationTaskStatusType;
    if (
      taskStatus === 'completed' ||
      taskStatus === 'failed' ||
      taskStatus === 'canceled'
    ) {
      return { taskId: task.id, status: taskStatus };
    }

    await this.tasksRepository.updateTaskStatus({
      taskId: task.id,
      status: 'canceled',
    });
    await this.tasksRepository.updateMessageStatus({
      messageId: task.assistantMessageId,
      status: 'canceled',
      partial: true,
    });

    return { taskId: task.id, status: 'canceled' };
  }
}
