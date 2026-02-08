import { Controller, Get, Param, Query, Req, UseGuards, ValidationPipe, Inject } from '@nestjs/common';
import { Request } from 'express';
import { MessagesService } from './messages.service';
import { ListMessagesQueryDto } from './dto';
import { AuthGuard } from '../auth/auth.guard';

@Controller('conversations')
@UseGuards(AuthGuard)
export class MessagesController {
  constructor(@Inject(MessagesService) private readonly messagesService: MessagesService) {}

  @Get(':conversationId/messages')
  async list(
    @Req() request: Request,
    @Param('conversationId') conversationId: string,
    @Query(ValidationPipe) query: ListMessagesQueryDto,
  ) {
    const result = await this.messagesService.listMessages(request, conversationId, query);
    const traceId = request.headers['x-trace-id'] as string;
    return { ...result, traceId };
  }
}
