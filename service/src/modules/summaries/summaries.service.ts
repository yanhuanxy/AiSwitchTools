import { Injectable, NotFoundException, ConflictException, Logger, Inject, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SummariesRepository } from './summaries.repository';
import { SummariesProvider } from './summaries.provider';
import { CreateSummaryDto, UpdateSummaryDto } from './dto';
import { SummaryEntity, SummaryWithConversation } from './entities';
import { ulid } from 'ulid';

export interface SummaryResponse {
  summaryId: string;
  conversationId: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SummaryListResponse {
  items: SummaryResponse[];
  nextCursor?: string;
}

export interface SummaryGenerationResult {
  summaryId: string;
  conversationId: string;
  content: string;
  tokenCount: number;
  model: string;
  triggerReason: string;
  created: boolean; // true表示新建，false表示更新
}

export interface SummaryStats {
  total: number;
  byStatus: {
    hasSummary: number;
    needsSummary: number;
    staleSummary: number;
  };
}

@Injectable()
export class SummariesService {
  private readonly logger = new Logger(SummariesService.name);
  private readonly minMessageCount: number;
  private readonly minTokenCount: number;
  private readonly maxSummaryTokens: number;
  private readonly summaryStaleHours: number;
  private readonly enableAutoGeneration: boolean;

  constructor(
    @Inject(SummariesRepository) private readonly summariesRepository: SummariesRepository,
    @Inject(SummariesProvider) private readonly summariesProvider: SummariesProvider,
    @Optional() @Inject(ConfigService) private readonly configService?: ConfigService,
  ) {
    this.minMessageCount = this.configService?.get('SUMMARY_MIN_MESSAGES', 10) ?? 10;
    this.minTokenCount = this.configService?.get('SUMMARY_MIN_TOKENS', 4000) ?? 4000;
    this.maxSummaryTokens = this.configService?.get('SUMMARY_MAX_TOKENS', 200) ?? 200;
    this.summaryStaleHours = this.configService?.get('SUMMARY_STALE_HOURS', 24) ?? 24;
    this.enableAutoGeneration = this.configService?.get('SUMMARY_AUTO_GENERATION', true) ?? true;
  }

  /**
   * 获取会话摘要
   */
  async getSummary(conversationId: string, ownerUserId: string): Promise<SummaryWithConversation> {
    const summary = await this.summariesRepository.findByConversationIdAndOwner(
      conversationId,
      ownerUserId,
    );

    if (!summary) {
      throw new NotFoundException(`Summary for conversation ${conversationId} not found`);
    }

    return summary;
  }

  /**
   * 检查会话是否有摘要
   */
  async hasSummary(conversationId: string, ownerUserId: string): Promise<boolean> {
    return this.summariesRepository.existsByConversationId(conversationId);
  }

  /**
   * 获取用户的摘要列表
   */
  async listSummaries(
    ownerUserId: string,
    cursor?: string,
    limit: number = 20,
  ): Promise<SummaryListResponse> {
    const { items, nextCursor } = await this.summariesRepository.findByOwner(
      ownerUserId,
      cursor,
      limit,
    );

    const enrichedItems = items.map(item => ({
      summaryId: item.id,
      conversationId: item.conversationId,
      content: item.content,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      conversationTitle: item.conversation?.title,
    }));

    return {
      items: enrichedItems,
      nextCursor,
    };
  }

  /**
   * 创建会话摘要
   */
  async createSummary(
    ownerUserId: string,
    createDto: CreateSummaryDto,
  ): Promise<SummaryResponse> {
    const { conversationId, content, triggerReason } = createDto;

    // 验证会话存在且属于当前用户
    const hasConversation = await this.validateConversationOwnership(conversationId, ownerUserId);
    if (!hasConversation) {
      throw new NotFoundException(`Conversation ${conversationId} not found`);
    }

    // 检查是否已存在摘要
    const existingSummary = await this.summariesRepository.findByConversationId(conversationId);
    if (existingSummary) {
      throw new ConflictException(`Summary already exists for conversation ${conversationId}`);
    }

    // 验证摘要内容
    const validation = await this.getProvider().validateSummaryQuality(content);
    if (!validation.isValid) {
      throw new ConflictException(`Invalid summary content: ${validation.issues.join(', ')}`);
    }

    const summaryId = `sum_${ulid()}`;
    const summary = await this.summariesRepository.create({
      id: summaryId,
      conversationId,
      content,
    });

    this.logger.log(`Created summary ${summaryId} for conversation ${conversationId}, reason: ${triggerReason || 'manual'}`);

    return {
      summaryId: summary.id,
      conversationId: summary.conversationId,
      content: summary.content,
      createdAt: summary.createdAt,
      updatedAt: summary.updatedAt,
    };
  }

  /**
   * 更新会话摘要
   */
  async updateSummary(
    conversationId: string,
    ownerUserId: string,
    updateDto: UpdateSummaryDto,
  ): Promise<SummaryResponse> {
    const { content, updateReason } = updateDto;

    // 验证会话存在且属于当前用户
    const hasConversation = await this.validateConversationOwnership(conversationId, ownerUserId);
    if (!hasConversation) {
      throw new NotFoundException(`Conversation ${conversationId} not found`);
    }

    // 获取现有摘要
    const existingSummary = await this.summariesRepository.findByConversationId(conversationId);
    if (!existingSummary) {
      throw new NotFoundException(`Summary for conversation ${conversationId} not found`);
    }

    // 验证摘要内容
    const validation = await this.getProvider().validateSummaryQuality(content);
    if (!validation.isValid) {
      throw new ConflictException(`Invalid summary content: ${validation.issues.join(', ')}`);
    }

    const updatedSummary = await this.summariesRepository.update(existingSummary.id, content);

    this.logger.log(`Updated summary ${updatedSummary.id} for conversation ${conversationId}, reason: ${updateReason || 'manual'}`);

    return {
      summaryId: updatedSummary.id,
      conversationId: updatedSummary.conversationId,
      content: updatedSummary.content,
      createdAt: updatedSummary.createdAt,
      updatedAt: updatedSummary.updatedAt,
    };
  }

  /**
   * 删除会话摘要
   */
  async deleteSummary(conversationId: string, ownerUserId: string): Promise<void> {
    // 验证会话存在且属于当前用户
    const hasConversation = await this.validateConversationOwnership(conversationId, ownerUserId);
    if (!hasConversation) {
      throw new NotFoundException(`Conversation ${conversationId} not found`);
    }

    const summary = await this.summariesRepository.findByConversationId(conversationId);
    if (!summary) {
      throw new NotFoundException(`Summary for conversation ${conversationId} not found`);
    }

    await this.summariesRepository.delete(summary.id);

    this.logger.log(`Deleted summary ${summary.id} for conversation ${conversationId}`);
  }

  /**
   * 自动生成会话摘要
   */
  async generateSummary(
    conversationId: string,
    ownerUserId: string,
    forceRegenerate: boolean = false,
  ): Promise<SummaryGenerationResult> {
    // 验证会话存在且属于当前用户
    const hasConversation = await this.validateConversationOwnership(conversationId, ownerUserId);
    if (!hasConversation) {
      throw new NotFoundException(`Conversation ${conversationId} not found`);
    }

    // 检查是否已存在摘要
    const existingSummary = await this.summariesRepository.findByConversationId(conversationId);

    // 如果不强制重新生成且已存在摘要，直接返回现有摘要
    if (!forceRegenerate && existingSummary) {
      return {
        summaryId: existingSummary.id,
        conversationId: existingSummary.conversationId,
        content: existingSummary.content,
        tokenCount: Math.ceil(existingSummary.content.length * 1.5), // 估算
        model: 'existing',
        triggerReason: 'existing_summary',
        created: false,
      };
    }

    // 获取会话消息
    const messages = await this.summariesRepository.getConversationMessagesForSummary(conversationId, 50);

    if (messages.length === 0) {
      throw new ConflictException(`No messages found in conversation ${conversationId}`);
    }

    // 验证是否需要生成摘要
    const shouldGenerate = this.shouldGenerateSummary(messages.length, messages);
    if (!shouldGenerate) {
      // 允许手动触发，即使不满足条件
      if (!forceRegenerate) {
        throw new ConflictException(`Conversation ${conversationId} does not meet summary generation criteria`);
      }
    }

    // 生成摘要
    const generatedSummary = await this.getProvider().generateSummary({
      conversationId,
      messages,
      maxTokens: this.maxSummaryTokens,
      includeSystemPrompt: true,
    });

    // 保存或更新摘要
    let savedSummary: SummaryEntity;
    if (existingSummary) {
      savedSummary = await this.summariesRepository.update(existingSummary.id, generatedSummary.content);
    } else {
      const summaryId = `sum_${ulid()}`;
      savedSummary = await this.summariesRepository.create({
        id: summaryId,
        conversationId,
        content: generatedSummary.content,
      });
    }

    this.logger.log(`Generated summary ${savedSummary.id} for conversation ${conversationId}, reason: ${generatedSummary.triggerReason}`);

    return {
      summaryId: savedSummary.id,
      conversationId: savedSummary.conversationId,
      content: savedSummary.content,
      tokenCount: generatedSummary.tokenCount,
      model: generatedSummary.model,
      triggerReason: generatedSummary.triggerReason,
      created: !existingSummary,
    };
  }

  /**
   * 批量生成会话摘要
   */
  async batchGenerateSummaries(
    conversationIds: string[],
    ownerUserId: string,
  ): Promise<SummaryGenerationResult[]> {
    const results: SummaryGenerationResult[] = [];

    for (const conversationId of conversationIds) {
      try {
        const result = await this.generateSummary(conversationId, ownerUserId);
        results.push(result);
      } catch (error) {
        this.logger.error(`Failed to generate summary for conversation ${conversationId}:`, error);
        // 继续处理其他会话，不中断批量操作
      }
    }

    return results;
  }

  /**
   * 获取需要摘要的会话
   */
  async getConversationsNeedingSummary(ownerUserId: string): Promise<Array<{
    conversationId: string;
    messageCount: number;
    totalTokens: number;
    lastMessageAt: Date;
  }>> {
    return this.summariesRepository.findNeedingSummary(
      ownerUserId,
      this.minMessageCount,
      this.minTokenCount,
    );
  }

  /**
   * 获取过期的摘要
   */
  async getStaleSummaries(): Promise<SummaryWithConversation[]> {
    return this.summariesRepository.findStaleSummaries(this.summaryStaleHours);
  }

  /**
   * 更新过期摘要
   */
  async refreshStaleSummaries(ownerUserId?: string): Promise<number> {
    const staleSummaries = await this.getStaleSummaries();
    let refreshedCount = 0;

    for (const summary of staleSummaries) {
      if (!summary.conversation) {
        continue;
      }
      // 如果指定了用户ID，只处理该用户的摘要
      if (ownerUserId && summary.conversation.ownerUserId !== ownerUserId) {
        continue;
      }

      try {
        await this.generateSummary(summary.conversationId, summary.conversation.ownerUserId, true);
        refreshedCount++;
      } catch (error) {
        this.logger.error(`Failed to refresh stale summary ${summary.id}:`, error);
      }
    }

    this.logger.log(`Refreshed ${refreshedCount} stale summaries`);
    return refreshedCount;
  }

  /**
   * 获取摘要统计
   */
  async getSummaryStats(ownerUserId?: string): Promise<SummaryStats> {
    const stats = await this.summariesRepository.getSummaryStats(ownerUserId);

    // 获取过期摘要数量
    const staleSummaries = await this.getStaleSummaries();
    const staleCount = ownerUserId
      ? staleSummaries.filter(s => s.conversation && s.conversation.ownerUserId === ownerUserId).length
      : staleSummaries.length;

    return {
      ...stats,
      byStatus: {
        ...stats.byStatus,
        staleSummary: staleCount,
      },
    };
  }

  /**
   * 清理孤立摘要
   */
  async cleanupOrphanedSummaries(): Promise<number> {
    const deletedCount = await this.summariesRepository.cleanupOrphanedSummaries();
    this.logger.log(`Cleaned up ${deletedCount} orphaned summaries`);
    return deletedCount;
  }

  /**
   * 验证会话所有权
   */
  private async validateConversationOwnership(
    conversationId: string,
    ownerUserId: string,
  ): Promise<boolean> {
    // TODO: 这里应该调用ConversationsService的验证方法
    // 临时实现：直接查询数据库
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();

    const conversation = await prisma.conversation.findFirst({
      where: {
        id: conversationId,
        ownerUserId,
        deletedAt: null,
      },
      select: {
        id: true,
      },
    });

    return !!conversation;
  }

  /**
   * 判断是否需要生成摘要
   */
  private shouldGenerateSummary(
    messageCount: number,
    messages: Array<{ content: string }>,
  ): boolean {
    // 检查消息数量
    if (messageCount >= this.minMessageCount) {
      return true;
    }

    // 检查token数量（简单估算）
    const totalContent = messages.map(m => m.content).join(' ');
    const chineseChars = (totalContent.match(/[\u4e00-\u9fa5]/g) || []).length;
    const englishChars = (totalContent.match(/[a-zA-Z]/g) || []).length;
    const estimatedTokens = chineseChars * 1.5 + englishChars * 0.25;

    return estimatedTokens >= this.minTokenCount;
  }

  private getProvider(): SummariesProvider {
    if (!this.summariesProvider) {
      throw new ConflictException('SUMMARY_PROVIDER_UNAVAILABLE');
    }
    return this.summariesProvider;
  }

  /**
   * 提取摘要关键词
   */
  async extractKeywords(summaryId: string, ownerUserId: string): Promise<string[]> {
    const summary = await this.summariesRepository.findById(summaryId);
    if (!summary) {
      throw new NotFoundException(`Summary ${summaryId} not found`);
    }

    // 验证所有权
    const hasOwnership = await this.validateConversationOwnership(summary.conversationId, ownerUserId);
    if (!hasOwnership) {
      throw new NotFoundException(`Summary ${summaryId} not found`);
    }

    return this.getProvider().extractKeywords(summary.content);
  }

  /**
   * 验证摘要质量
   */
  async validateSummary(summaryId: string, ownerUserId: string): Promise<{
    isValid: boolean;
    issues: string[];
    score: number;
  }> {
    const summary = await this.summariesRepository.findById(summaryId);
    if (!summary) {
      throw new NotFoundException(`Summary ${summaryId} not found`);
    }

    // 验证所有权
    const hasOwnership = await this.validateConversationOwnership(summary.conversationId, ownerUserId);
    if (!hasOwnership) {
      throw new NotFoundException(`Summary ${summaryId} not found`);
    }

    return this.getProvider().validateSummaryQuality(summary.content);
  }

  /**
   * 获取摘要配置
   */
  getSummaryConfig(): {
    minMessageCount: number;
    minTokenCount: number;
    maxSummaryTokens: number;
    summaryStaleHours: number;
    enableAutoGeneration: boolean;
    model: string;
  } {
    return {
      minMessageCount: this.minMessageCount,
      minTokenCount: this.minTokenCount,
      maxSummaryTokens: this.maxSummaryTokens,
      summaryStaleHours: this.summaryStaleHours,
      enableAutoGeneration: this.enableAutoGeneration,
      model: this.configService?.get('SUMMARY_MODEL', 'gpt-3.5-turbo') ?? 'gpt-3.5-turbo',
    };
  }

  /**
   * 模拟摘要生成（用于开发测试）
   */
  async generateMockSummary(conversationId: string, ownerUserId: string): Promise<SummaryGenerationResult> {
    // 验证会话所有权
    const hasOwnership = await this.validateConversationOwnership(conversationId, ownerUserId);
    if (!hasOwnership) {
      throw new NotFoundException(`Conversation ${conversationId} not found`);
    }

    // 生成模拟摘要
    const mockResult = await this.getProvider().generateMockSummaryForTesting(conversationId);

    // 查找或创建摘要记录
    const existingSummary = await this.summariesRepository.findByConversationId(conversationId);
    let savedSummary: SummaryEntity;

    if (existingSummary) {
      savedSummary = await this.summariesRepository.update(existingSummary.id, mockResult.content);
    } else {
      const summaryId = `sum_${ulid()}`;
      savedSummary = await this.summariesRepository.create({
        id: summaryId,
        conversationId,
        content: mockResult.content,
      });
    }

    return {
      summaryId: savedSummary.id,
      conversationId: savedSummary.conversationId,
      content: savedSummary.content,
      tokenCount: mockResult.tokenCount,
      model: mockResult.model,
      triggerReason: mockResult.triggerReason,
      created: !existingSummary,
    };
  }
}

// 扩展Repository类型声明
declare module './summaries.repository' {
  interface SummariesRepository {
    getConversationMessagesForSummary(
      conversationId: string,
      limit?: number,
    ): Promise<Array<{
      id: string;
      role: string;
      content: string;
      createdAt: Date;
    }>>;
  }
}
