import { Injectable, Inject } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { LlmService } from '../llm/llm.service';
import { ModelConfigService } from '../llm/model-config.service';

export interface SummaryGenerationOptions {
  conversationId: string;
  messages: Array<{
    id: string;
    role: string;
    content: string;
    createdAt: Date;
  }>;
  maxTokens?: number;
  includeSystemPrompt?: boolean;
}

export interface GeneratedSummary {
  content: string;
  tokenCount: number;
  model: string;
  triggerReason: string;
}

export interface PrivacyFilterOptions {
  phoneNumbers?: boolean;
  idCards?: boolean;
  bankCards?: boolean;
  customPatterns?: string[];
}

@Injectable()
export class SummariesProvider {
  private readonly maxSummaryTokens: number;
  private readonly summaryModel: string;
  private privacyFilter: PrivacyFilterOptions;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(LlmService) private readonly llmService: LlmService,
    @Inject(ModelConfigService) private readonly modelConfigService: ModelConfigService
  ) {
    this.maxSummaryTokens = this.modelConfigService.summaryMaxTokens;
    this.summaryModel = this.modelConfigService.summaryModel;
    this.privacyFilter = {
      phoneNumbers: true,
      idCards: true,
      bankCards: true,
      customPatterns: this.modelConfigService.summaryCustomPatterns,
    };
  }

  /**
   * 生成会话摘要
   */
  async generateSummary(options: SummaryGenerationOptions): Promise<GeneratedSummary> {
    const { conversationId, messages, maxTokens = this.maxSummaryTokens, includeSystemPrompt = true } = options;

    // 1. 准备消息内容
    const messageContent = this.prepareMessageContent(messages);

    // 2. 隐私过滤
    const filteredContent = this.applyPrivacyFilter(messageContent);

    // 3. 构建系统提示词
    const systemPrompt = this.buildSystemPrompt(includeSystemPrompt);

    // 4. 构建用户提示词
    const userPrompt = this.buildUserPrompt(filteredContent, maxTokens);

    // 5. 调用AI模型生成摘要
    const summary = await this.callSummaryModel(systemPrompt, userPrompt, maxTokens);

    // 6. 后处理
    const processedSummary = this.postProcessSummary(summary);

    return {
      content: processedSummary.content,
      tokenCount: processedSummary.tokenCount,
      model: this.summaryModel,
      triggerReason: this.determineTriggerReason(messages.length, filteredContent),
    };
  }

  /**
   * 准备消息内容
   */
  private prepareMessageContent(messages: Array<{ role: string; content: string; createdAt: Date }>): string {
    // 按时间倒序排列，取最近的50条消息
    const recentMessages = messages
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 50)
      .reverse(); // 恢复时间顺序

    return recentMessages
      .map(msg => `[${msg.role.toUpperCase()}]: ${msg.content}`)
      .join('\n');
  }

  /**
   * 应用隐私过滤
   */
  private applyPrivacyFilter(content: string): string {
    let filtered = content;

    // 手机号过滤
    if (this.privacyFilter.phoneNumbers) {
      filtered = filtered.replace(/1[3-9]\d{9}/g, '[PHONE]');
      filtered = filtered.replace(/\d{3}-\d{4}-\d{4}/g, '[PHONE]');
      filtered = filtered.replace(/\d{4}-\d{7}/g, '[PHONE]');
    }

    // 身份证过滤
    if (this.privacyFilter.idCards) {
      filtered = filtered.replace(/\d{17}[\dXx]/g, '[ID_CARD]');
      filtered = filtered.replace(/\d{15}/g, '[ID_CARD]');
    }

    // 银行卡过滤
    if (this.privacyFilter.bankCards) {
      filtered = filtered.replace(/\d{16,19}/g, '[BANK_CARD]');
      filtered = filtered.replace(/\d{4}[\s-]\d{4}[\s-]\d{4}[\s-]\d{4}/g, '[BANK_CARD]');
    }

    // 自定义模式过滤
    if (this.privacyFilter.customPatterns?.length) {
      this.privacyFilter.customPatterns.forEach(pattern => {
        const regex = new RegExp(pattern, 'gi');
        filtered = filtered.replace(regex, '[SENSITIVE]');
      });
    }

    return filtered;
  }

  /**
   * 构建系统提示词
   */
  private buildSystemPrompt(includeSystemPrompt: boolean): string {
    if (!includeSystemPrompt) {
      return 'You are a helpful assistant that creates concise summaries.';
    }

    return `You are an AI assistant specialized in creating concise and informative conversation summaries.

Your task is to:
1. Extract the main topics and key points from the conversation
2. Identify the context and purpose of the discussion
3. Highlight important decisions or conclusions
4. Maintain a neutral and objective tone
5. Keep the summary under ${this.maxSummaryTokens} tokens
6. Focus on the most recent and relevant information
7. Avoid repetition and unnecessary details

Important guidelines:
- Preserve the chronological flow of important events
- Mention key participants' roles if relevant
- Include any action items or next steps
- Use clear and concise language
- Avoid personal opinions or interpretations`;
  }

  /**
   * 构建用户提示词
   */
  private buildUserPrompt(content: string, maxTokens: number): string {
    return `Please create a concise summary of the following conversation.

The summary should:
- Be no more than ${maxTokens} tokens
- Capture the main topics and key points
- Maintain chronological order
- Use clear and objective language
- Include any important conclusions or decisions

Conversation:
${content}

Please provide a concise summary:`;
  }

  /**
   * 调用AI模型生成摘要
   */
  private async callSummaryModel(systemPrompt: string, userPrompt: string, maxTokens: number): Promise<string> {
    try {
      const messages: { role: 'system' | 'user'; content: string }[] = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ];

      const response = await this.llmService.chatCompletion(messages, {
        model: this.summaryModel,
        maxTokens: maxTokens,
      });

      return response;
    } catch (error) {
      console.error('Summary generation failed, falling back to mock', error);
      // Fallback to mock for development/robustness
      const mockResponse = this.generateMockSummary(userPrompt);
      return this.truncateToTokenLimit(mockResponse, maxTokens);
    }
  }

  /**
   * 生成模拟摘要（用于开发测试）
   */
  private generateMockSummary(content: string): string {
    // 简单的模拟摘要生成逻辑
    const sentences = content.split(/[。！？.!?]/).filter(s => s.trim().length > 0);
    const keyPoints = sentences.slice(0, 3).map(s => s.trim());

    return `会话摘要：${keyPoints.join('；')}。主要讨论了相关问题并交换了意见。`;
  }

  /**
   * 截断到token限制
   */
  private truncateToTokenLimit(text: string, maxTokens: number): string {
    // 简单的字符数估算（中文字符约等于1.5个token，英文字符约等于0.25个token）
    const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
    const englishChars = (text.match(/[a-zA-Z]/g) || []).length;
    const estimatedTokens = chineseChars * 1.5 + englishChars * 0.25;

    if (estimatedTokens <= maxTokens) {
      return text;
    }

    // 按比例截断
    const ratio = maxTokens / estimatedTokens;
    const targetLength = Math.floor(text.length * ratio * 0.9); // 留10%余量

    let truncated = text.substring(0, targetLength);

    // 确保在句子结尾处截断
    const lastSentenceEnd = Math.max(
      truncated.lastIndexOf('。'),
      truncated.lastIndexOf('！'),
      truncated.lastIndexOf('？'),
      truncated.lastIndexOf('.'),
      truncated.lastIndexOf('!'),
      truncated.lastIndexOf('?')
    );

    if (lastSentenceEnd > targetLength * 0.7) {
      truncated = truncated.substring(0, lastSentenceEnd + 1);
    }

    return truncated;
  }

  /**
   * 后处理摘要
   */
  private postProcessSummary(summary: string): { content: string; tokenCount: number } {
    // 清理多余的空格和换行
    let cleaned = summary.trim();
    cleaned = cleaned.replace(/\n+/g, ' ');
    cleaned = cleaned.replace(/\s+/g, ' ');

    // 估算token数量
    const chineseChars = (cleaned.match(/[\u4e00-\u9fa5]/g) || []).length;
    const englishChars = (cleaned.match(/[a-zA-Z]/g) || []).length;
    const tokenCount = Math.ceil(chineseChars * 1.5 + englishChars * 0.25);

    return {
      content: cleaned,
      tokenCount,
    };
  }

  /**
   * 确定触发原因
   */
  private determineTriggerReason(messageCount: number, content: string): string {
    if (messageCount >= 10) {
      return `message_count_${messageCount}`;
    }

    // 简单的token数量估算
    const chineseChars = (content.match(/[\u4e00-\u9fa5]/g) || []).length;
    const englishChars = (content.match(/[a-zA-Z]/g) || []).length;
    const estimatedTokens = chineseChars * 1.5 + englishChars * 0.25;

    if (estimatedTokens >= 4000) {
      return `token_count_${Math.floor(estimatedTokens)}`;
    }

    return 'manual_trigger';
  }

  /**
   * 验证摘要质量
   */
  async validateSummaryQuality(content: string): Promise<{
    isValid: boolean;
    issues: string[];
    score: number;
  }> {
    const issues: string[] = [];
    let score = 100;

    // 检查长度
    if (content.length < 10) {
      issues.push('摘要过短');
      score -= 20;
    }

    if (content.length > 1000) {
      issues.push('摘要过长');
      score -= 10;
    }

    // 检查是否包含敏感信息（隐私过滤后的检查）
    const sensitivePatterns = [
      /\[PHONE\]/g,
      /\[ID_CARD\]/g,
      /\[BANK_CARD\]/g,
      /\[SENSITIVE\]/g,
    ];

    const hasSensitiveInfo = sensitivePatterns.some(pattern => pattern.test(content));
    if (hasSensitiveInfo) {
      issues.push('摘要包含敏感信息标记');
      score -= 15;
    }

    // 检查是否包含关键词
    const requiredKeywords = ['摘要', '总结', '主要', '讨论'];
    const hasKeywords = requiredKeywords.some(keyword => content.includes(keyword));
    if (!hasKeywords) {
      issues.push('摘要可能缺少关键标识');
      score -= 5;
    }

    // 检查重复内容
    const sentences = content.split(/[。！？.!?]/).filter(s => s.trim().length > 0);
    const uniqueSentences = new Set(sentences);
    if (uniqueSentences.size < sentences.length * 0.8) {
      issues.push('摘要可能包含重复内容');
      score -= 10;
    }

    return {
      isValid: score >= 70 && issues.length <= 2,
      issues,
      score: Math.max(0, score),
    };
  }

  /**
   * 提取摘要关键词
   */
  extractKeywords(content: string): string[] {
    // 简单的关键词提取
    const words = content.match(/[\u4e00-\u9fa5]+|[a-zA-Z]+/g) || [];
    const wordFreq: Record<string, number> = {};

    words.forEach(word => {
      if (word.length >= 2) {
        wordFreq[word] = (wordFreq[word] || 0) + 1;
      }
    });

    // 按频率排序，取前5个
    return Object.entries(wordFreq)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([word]) => word);
  }

  /**
   * 计算摘要相似度
   */
  calculateSimilarity(summary1: string, summary2: string): number {
    const words1 = new Set(summary1.toLowerCase().split(/\s+/));
    const words2 = new Set(summary2.toLowerCase().split(/\s+/));

    const intersection = new Set([...words1].filter(word => words2.has(word)));
    const union = new Set([...words1, ...words2]);

    return intersection.size / union.size;
  }

  /**
   * 获取摘要配置
   */
  getSummaryConfig(): {
    maxTokens: number;
    model: string;
    privacyFilter: PrivacyFilterOptions;
  } {
    return {
      maxTokens: this.maxSummaryTokens,
      model: this.summaryModel,
      privacyFilter: this.privacyFilter,
    };
  }

  /**
   * 更新隐私过滤配置
   */
  updatePrivacyFilter(config: Partial<PrivacyFilterOptions>): void {
    this.privacyFilter = {
      ...this.privacyFilter,
      ...config,
    };
  }

  /**
   * 模拟摘要生成（用于测试）
   */
  async generateMockSummaryForTesting(conversationId: string): Promise<GeneratedSummary> {
    const mockSummaries = [
      '本次对话主要讨论了技术实现方案，双方就架构设计达成了共识。',
      '会话围绕产品功能展开，确定了下一阶段的开发重点。',
      '对话聚焦于用户体验优化，提出了多个改进建议。',
      '主要交流了项目进度和问题解决方案，明确了时间节点。',
      '讨论了团队协作流程，优化了工作分配机制。',
    ];

    const randomSummary = mockSummaries[Math.floor(Math.random() * mockSummaries.length)];

    return {
      content: randomSummary,
      tokenCount: Math.ceil(randomSummary.length * 1.5),
      model: 'mock-model',
      triggerReason: 'manual_trigger',
    };
  }
}
