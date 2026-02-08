import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
  Inject,
} from '@nestjs/common';
import { Request } from 'express';
import { ConversationsService } from './conversations.service';
import { CreateConversationDto, UpdateConversationDto } from './dto';
import { MessagesService } from '../messages/messages.service';
import { AuthGuard } from '../auth/auth.guard';

@Controller('conversations')
@UseGuards(AuthGuard)
export class ConversationsController {
  constructor(
    @Inject(ConversationsService) private readonly conversationsService: ConversationsService,
    @Inject(MessagesService) private readonly messagesService: MessagesService,
  ) {}

  /**
   * 创建新会话
   * POST /api/conversations
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() createDto: CreateConversationDto,
    @Req() req: Request,
  ) {
    const ownerUserId = (req as any).user.id;
    const result = await this.conversationsService.create(ownerUserId, createDto);
    const traceId = req.headers['x-trace-id'] as string;

    return {
      conversationId: result.conversationId,
      characterVersionId: result.characterVersionId,
      traceId,
    };
  }

  /**
   * 获取会话列表
   * GET /api/conversations?cursor=&limit=
   */
  @Get()
  async findAll(
    @Req() req: Request,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    const ownerUserId = (req as any).user.id;
    const limitNum = Math.min(parseInt(limit ?? '20'), 100);

    const result = await this.conversationsService.findAll(
      ownerUserId,
      cursor,
      limitNum,
    );
    const traceId = req.headers['x-trace-id'] as string;

    return {
      items: result.items.map(item => ({
        conversationId: item.conversationId,
        title: item.title,
        updatedAt: item.updatedAt,
        lastMessagePreview: item.lastMessagePreview,
        lastMessageAt: item.lastMessageAt,
      })),
      nextCursor: result.nextCursor,
      traceId,
    };
  }

  /**
   * 获取会话详情
   * GET /api/conversations/:id
   */
  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    const ownerUserId = (req as any).user.id;
    const conversation = await this.conversationsService.findOne(id, ownerUserId);
    const traceId = req.headers['x-trace-id'] as string;

    return {
      conversationId: conversation.id,
      characterId: conversation.characterId,
      characterVersionId: conversation.characterVersionId,
      title: conversation.title,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
      lastMessageAt: conversation.lastMessageAt,
      traceId,
    };
  }

  /**
   * 更新会话标题
   * PATCH /api/conversations/:id
   */
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() updateDto: UpdateConversationDto,
    @Req() req: Request,
  ) {
    const ownerUserId = (req as any).user.id;
    const result = await this.conversationsService.update(id, ownerUserId, updateDto);
    const traceId = req.headers['x-trace-id'] as string;

    return {
      conversationId: result.conversationId,
      title: result.title,
      traceId,
    };
  }

  /**
   * 删除会话（软删除）
   * DELETE /api/conversations/:id
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    const ownerUserId = (req as any).user.id;
    await this.conversationsService.remove(id, ownerUserId);
  }

  /**
   * 获取会话消息列表
   * GET /api/conversations/:id/messages?cursor=&limit=
   */
  @Get(':id/messages')
  async findMessages(
    @Param('id') id: string,
    @Req() req: Request,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    const result = await this.messagesService.listMessages(req, id, {
      limit,
      cursor,
    });
    const traceId = req.headers['x-trace-id'] as string;
    return {
      items: result.items,
      nextCursor: result.nextCursor,
      traceId,
    };
  }
}
