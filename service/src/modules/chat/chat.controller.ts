import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  UseGuards,
  ValidationPipe,
  Inject,
} from '@nestjs/common';
import { Request } from 'express';
import { ChatService } from './chat.service';
import { CreateChatTaskDto } from './dto';
import { AuthGuard } from '../auth/auth.guard';

@Controller('chat')
@UseGuards(AuthGuard)
export class ChatController {
  constructor(@Inject(ChatService) private readonly chatService: ChatService) {}

  @Post('tasks')
  @HttpCode(HttpStatus.CREATED)
  async createTask(@Body(ValidationPipe) dto: CreateChatTaskDto, @Req() req: Request) {
    const ownerUserId = (req as any).user.id;
    const result = await this.chatService.createTask(ownerUserId, dto);
    const traceId = req.headers['x-trace-id'] as string;
    return {
      userMessageId: result.userMessageId,
      assistantMessageId: result.assistantMessageId,
      taskId: result.taskId,
      traceId,
    };
  }

  @Post('completion')
  @HttpCode(HttpStatus.CREATED)
  async createCompletion(@Body(ValidationPipe) dto: CreateChatTaskDto, @Req() req: Request) {
    const ownerUserId = (req as any).user.id;
    const result = await this.chatService.createTaskV2(ownerUserId, dto);
    const traceId = req.headers['x-trace-id'] as string;
    return {
      userMessageId: result.userMessageId,
      assistantMessageId: result.assistantMessageId,
      taskId: result.taskId,
      traceId,
    };
  }

  @Post('messages/:assistantMessageId/retry')
  @HttpCode(HttpStatus.CREATED)
  async retry(@Param('assistantMessageId') assistantMessageId: string, @Req() req: Request) {
    const ownerUserId = (req as any).user.id;
    const result = await this.chatService.retryMessage(ownerUserId, assistantMessageId);
    const traceId = req.headers['x-trace-id'] as string;
    return {
      newAssistantMessageId: result.newAssistantMessageId,
      taskId: result.taskId,
      traceId,
    };
  }

  @Post('messages/:assistantMessageId/continue')
  @HttpCode(HttpStatus.CREATED)
  async continue(@Param('assistantMessageId') assistantMessageId: string, @Req() req: Request) {
    const ownerUserId = (req as any).user.id;
    const result = await this.chatService.continueMessage(ownerUserId, assistantMessageId);
    const traceId = req.headers['x-trace-id'] as string;
    return {
      assistantMessageId: result.assistantMessageId,
      taskId: result.taskId,
      traceId,
    };
  }
}
