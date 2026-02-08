import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Param,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
  ValidationPipe,
  Inject
} from '@nestjs/common';
import { Request } from 'express';
import { SummariesService } from './summaries.service';
import { CreateSummaryDto, UpdateSummaryDto } from './dto';
import { AuthGuard } from '../auth/auth.guard';

@Controller('summaries')
@UseGuards(AuthGuard)
export class SummariesController {
  private readonly logger = new Logger(SummariesController.name);

  constructor(@Inject(SummariesService) private readonly summariesService: SummariesService) {}

  /**
   * 获取会话摘要
   * GET /api/summaries/conversation/:conversationId
   */
  @Get('conversation/:conversationId')
  async getSummary(
    @Param('conversationId') conversationId: string,
    @Req() req: Request,
  ) {
    const ownerUserId = (req as any).user.id;
    const summary = await this.summariesService.getSummary(conversationId, ownerUserId);
    const traceId = req.headers['x-trace-id'] as string;

    return {
      summaryId: summary.id,
      conversationId: summary.conversationId,
      content: summary.content,
      createdAt: summary.createdAt,
      updatedAt: summary.updatedAt,
      conversationTitle: summary.conversation?.title,
      traceId,
    };
  }

  /**
   * 获取用户摘要列表
   * GET /api/summaries?cursor=&limit=
   */
  @Get()
  async listSummaries(
    @Req() req: Request,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    const ownerUserId = (req as any).user.id;
    const limitNum = Math.min(parseInt(limit || '20'), 100);

    const result = await this.summariesService.listSummaries(ownerUserId, cursor, limitNum);
    const traceId = req.headers['x-trace-id'] as string;

    return {
      items: result.items,
      nextCursor: result.nextCursor,
      traceId,
    };
  }

  /**
   * 创建会话摘要
   * POST /api/summaries
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createSummary(
    @Body(ValidationPipe) createDto: CreateSummaryDto,
    @Req() req: Request,
  ) {
    const ownerUserId = (req as any).user.id;
    const result = await this.summariesService.createSummary(ownerUserId, createDto);
    const traceId = req.headers['x-trace-id'] as string;

    return {
      summaryId: result.summaryId,
      conversationId: result.conversationId,
      content: result.content,
      createdAt: result.createdAt,
      updatedAt: result.updatedAt,
      traceId,
    };
  }

  /**
   * 更新会话摘要
   * PUT /api/summaries/conversation/:conversationId
   */
  @Put('conversation/:conversationId')
  async updateSummary(
    @Param('conversationId') conversationId: string,
    @Body(ValidationPipe) updateDto: UpdateSummaryDto,
    @Req() req: Request,
  ) {
    const ownerUserId = (req as any).user.id;
    const result = await this.summariesService.updateSummary(conversationId, ownerUserId, updateDto);
    const traceId = req.headers['x-trace-id'] as string;

    return {
      summaryId: result.summaryId,
      conversationId: result.conversationId,
      content: result.content,
      createdAt: result.createdAt,
      updatedAt: result.updatedAt,
      traceId,
    };
  }

  /**
   * 删除会话摘要
   * DELETE /api/summaries/conversation/:conversationId
   */
  @Delete('conversation/:conversationId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteSummary(
    @Param('conversationId') conversationId: string,
    @Req() req: Request,
  ) {
    const ownerUserId = (req as any).user.id;
    await this.summariesService.deleteSummary(conversationId, ownerUserId);
  }

  /**
   * 自动生成会话摘要
   * POST /api/summaries/conversation/:conversationId/generate
   */
  @Post('conversation/:conversationId/generate')
  async generateSummary(
    @Param('conversationId') conversationId: string,
    @Req() req: Request,
    @Query('force') force?: string,
  ) {
    const ownerUserId = (req as any).user.id;
    const forceRegenerate = force === 'true' || force === '1';

    const result = await this.summariesService.generateSummary(
      conversationId,
      ownerUserId,
      forceRegenerate,
    );
    const traceId = req.headers['x-trace-id'] as string;

    return {
      summaryId: result.summaryId,
      conversationId: result.conversationId,
      content: result.content,
      tokenCount: result.tokenCount,
      model: result.model,
      triggerReason: result.triggerReason,
      created: result.created,
      traceId,
    };
  }

  /**
   * 批量生成会话摘要
   * POST /api/summaries/batch-generate
   */
  @Post('batch-generate')
  async batchGenerateSummaries(
    @Body() body: { conversationIds: string[] },
    @Req() req: Request,
  ) {
    const ownerUserId = (req as any).user.id;
    const { conversationIds } = body;

    if (!conversationIds || !Array.isArray(conversationIds) || conversationIds.length === 0) {
      throw new Error('conversationIds is required and must be a non-empty array');
    }

    const results = await this.summariesService.batchGenerateSummaries(conversationIds, ownerUserId);
    const traceId = req.headers['x-trace-id'] as string;

    return {
      results: results.map(result => ({
        summaryId: result.summaryId,
        conversationId: result.conversationId,
        content: result.content,
        tokenCount: result.tokenCount,
        model: result.model,
        triggerReason: result.triggerReason,
        created: result.created,
      })),
      total: results.length,
      traceId,
    };
  }

  /**
   * 获取需要摘要的会话
   * GET /api/summaries/needed
   */
  @Get('needed')
  async getConversationsNeedingSummary(@Req() req: Request) {
    const ownerUserId = (req as any).user.id;
    const conversations = await this.summariesService.getConversationsNeedingSummary(ownerUserId);
    const traceId = req.headers['x-trace-id'] as string;

    return {
      conversations: conversations.map(conv => ({
        conversationId: conv.conversationId,
        messageCount: conv.messageCount,
        totalTokens: conv.totalTokens,
        lastMessageAt: conv.lastMessageAt,
      })),
      total: conversations.length,
      criteria: {
        minMessageCount: 10,
        minTokenCount: 4000,
      },
      traceId,
    };
  }

  /**
   * 获取过期的摘要
   * GET /api/summaries/stale
   */
  @Get('stale')
  async getStaleSummaries(@Req() req: Request) {
    const staleSummaries = await this.summariesService.getStaleSummaries();
    const traceId = req.headers['x-trace-id'] as string;

    return {
      summaries: staleSummaries.map(summary => ({
        summaryId: summary.id,
        conversationId: summary.conversationId,
        content: summary.content,
        createdAt: summary.createdAt,
        updatedAt: summary.updatedAt,
        hoursOld: Math.floor((Date.now() - summary.updatedAt.getTime()) / (1000 * 60 * 60)),
      })),
      total: staleSummaries.length,
      traceId,
    };
  }

  /**
   * 刷新过期摘要
   * POST /api/summaries/refresh-stale
   */
  @Post('refresh-stale')
  async refreshStaleSummaries(@Req() req: Request) {
    const ownerUserId = (req as any).user.id;
    const refreshedCount = await this.summariesService.refreshStaleSummaries(ownerUserId);
    const traceId = req.headers['x-trace-id'] as string;

    return {
      refreshedCount,
      message: `Successfully refreshed ${refreshedCount} stale summaries`,
      traceId,
    };
  }

  /**
   * 获取摘要统计
   * GET /api/summaries/stats
   */
  @Get('stats')
  async getSummaryStats(@Req() req: Request) {
    const ownerUserId = (req as any).user.id;
    const stats = await this.summariesService.getSummaryStats(ownerUserId);
    const traceId = req.headers['x-trace-id'] as string;

    return {
      stats,
      config: this.summariesService.getSummaryConfig(),
      traceId,
    };
  }

  /**
   * 提取摘要关键词
   * GET /api/summaries/:summaryId/keywords
   */
  @Get(':summaryId/keywords')
  async extractKeywords(
    @Param('summaryId') summaryId: string,
    @Req() req: Request,
  ) {
    const ownerUserId = (req as any).user.id;
    const keywords = await this.summariesService.extractKeywords(summaryId, ownerUserId);
    const traceId = req.headers['x-trace-id'] as string;

    return {
      summaryId,
      keywords,
      traceId,
    };
  }

  /**
   * 验证摘要质量
   * GET /api/summaries/:summaryId/validate
   */
  @Get(':summaryId/validate')
  async validateSummary(
    @Param('summaryId') summaryId: string,
    @Req() req: Request,
  ) {
    const ownerUserId = (req as any).user.id;
    const validation = await this.summariesService.validateSummary(summaryId, ownerUserId);
    const traceId = req.headers['x-trace-id'] as string;

    return {
      summaryId,
      ...validation,
      traceId,
    };
  }

  /**
   * 模拟摘要生成（用于开发测试）
   * POST /api/summaries/conversation/:conversationId/mock-generate
   */
  @Post('conversation/:conversationId/mock-generate')
  async generateMockSummary(
    @Param('conversationId') conversationId: string,
    @Req() req: Request,
  ) {
    const ownerUserId = (req as any).user.id;
    const traceId = req.headers['x-trace-id'] as string;

    try {
      const result = await this.summariesService.generateMockSummary(conversationId, ownerUserId);

      return {
        summaryId: result.summaryId,
        conversationId: result.conversationId,
        content: result.content,
        tokenCount: result.tokenCount,
        model: result.model,
        triggerReason: result.triggerReason,
        created: result.created,
        isMock: true,
        traceId,
      };
    } catch (error) {
      this.logger.warn(`Mock generation failed for conversation ${conversationId}:`, error);
      throw error;
    }
  }

  /**
   * 清理孤立摘要（管理员接口）
   * POST /api/summaries/cleanup-orphaned
   */
  @Post('cleanup-orphaned')
  async cleanupOrphanedSummaries(@Req() req: Request) {
    // TODO: 添加管理员权限验证
    const deletedCount = await this.summariesService.cleanupOrphanedSummaries();
    const traceId = req.headers['x-trace-id'] as string;

    return {
      deletedCount,
      message: `Successfully cleaned up ${deletedCount} orphaned summaries`,
      traceId,
    };
  }

  /**
   * 获取摘要配置
   * GET /api/summaries/config
   */
  @Get('config')
  getSummaryConfig(@Req() req: Request) {
    const traceId = req.headers['x-trace-id'] as string;
    return {
      ...this.summariesService.getSummaryConfig(),
      traceId,
    };
  }

  /**
   * 检查会话是否有摘要
   * GET /api/summaries/conversation/:conversationId/exists
   */
  @Get('conversation/:conversationId/exists')
  async hasSummary(
    @Param('conversationId') conversationId: string,
    @Req() req: Request,
  ) {
    const ownerUserId = (req as any).user.id;
    const hasSummary = await this.summariesService.hasSummary(conversationId, ownerUserId);
    const traceId = req.headers['x-trace-id'] as string;

    return {
      conversationId,
      hasSummary,
      traceId,
    };
  }
}
