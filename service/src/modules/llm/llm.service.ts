import { Injectable, Logger, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { Stream } from 'openai/streaming';
import Anthropic from '@anthropic-ai/sdk';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}

// Unified interface for stream chunks
export interface UnifiedChunk {
  content: string;
  // Can add more fields if needed
}

@Injectable()
export class LlmService {
  private openai: OpenAI | null = null;
  private anthropic: Anthropic | null = null;
  private readonly logger = new Logger(LlmService.name);

  constructor(@Inject(ConfigService) private readonly configService: ConfigService) {
    this.initClients();
  }

  private initClients() {
    // OpenAI Init
    const openAiKey = this.configService.get('OPENAI_API_KEY');
    const openAiBase = this.configService.get('OPENAI_BASE_URL');
    if (openAiKey) {
      this.openai = new OpenAI({
        apiKey: openAiKey,
        baseURL: openAiBase || undefined,
      });
      this.logger.log('OpenAI client initialized');
    }

    // Anthropic Init
    const anthropicKey = this.configService.get('ANTHROPIC_AUTH_TOKEN');
    const anthropicBase = this.configService.get('ANTHROPIC_BASE_URL');
    if (anthropicKey) {
      this.anthropic = new Anthropic({
        apiKey: anthropicKey,
        baseURL: anthropicBase || undefined,
      });
      this.logger.log('Anthropic client initialized');
    }

    if (!this.openai && !this.anthropic) {
      this.logger.warn('No LLM client initialized (missing keys)');
    }
  }

  private shouldUseAnthropic(model: string): boolean {
    // Check if explicitly configured as Anthropic model
    const anthropicModel = this.configService.get('ANTHROPIC_MODEL');
    if (anthropicModel && model === anthropicModel) return true;

    // Check naming convention
    if (model.startsWith('claude-') || model.startsWith('kimi-')) {
       // Note: user config uses 'kimi-...' in ANTHROPIC_MODEL, so treat it as Anthropic if it matches
       return !!this.anthropic;
    }
    
    // Fallback logic: if OpenAI is missing but Anthropic exists, use Anthropic
    if (!this.openai && this.anthropic) return true;

    return false;
  }

  async chatCompletion(
    messages: ChatMessage[],
    options: ChatOptions = {},
  ): Promise<string> {
    try {
      let model = options.model || this.configService.get('CHAT_DEFAULT_MODEL') || this.configService.get('ANTHROPIC_MODEL') || 'gpt-3.5-turbo';
      
      if (this.shouldUseAnthropic(model)) {
         return this.chatCompletionAnthropic(messages, model, options);
      } else {
         return this.chatCompletionOpenAI(messages, model, options);
      }
    } catch (error) {
      this.logger.error('Chat completion failed', error);
      throw error;
    }
  }

  private async chatCompletionOpenAI(messages: ChatMessage[], model: string, options: ChatOptions): Promise<string> {
    if (!this.openai) throw new Error('OpenAI client not initialized');
    const response = await this.openai.chat.completions.create({
        model,
        messages,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens,
        stream: false,
    });
    return response.choices[0]?.message?.content || '';
  }

  private async chatCompletionAnthropic(messages: ChatMessage[], model: string, options: ChatOptions): Promise<string> {
    if (!this.anthropic) throw new Error('Anthropic client not initialized');

    // Convert messages to Anthropic format
    // Anthropic requires system prompt to be separate
    const systemMessage = messages.find(m => m.role === 'system');
    const userAssistantMessages = messages.filter(m => m.role !== 'system');
    
    const anthropicMessages = userAssistantMessages.map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content
    }));

    const response = await this.anthropic.messages.create({
        model,
        system: systemMessage?.content,
        messages: anthropicMessages,
        max_tokens: options.maxTokens ?? 4096, // Anthropic requires max_tokens
        temperature: options.temperature ?? 0.7,
        stream: false,
    });

    // Handle ContentBlock
    const content = response.content[0];
    if (content.type === 'text') {
        return content.text;
    }
    return '';
  }

  // Returns an async iterable that yields unified chunks
  async chatStream(
    messages: ChatMessage[],
    options: ChatOptions = {},
  ): Promise<AsyncIterable<UnifiedChunk>> {
    try {
      let model = options.model || this.configService.get('CHAT_DEFAULT_MODEL') || this.configService.get('ANTHROPIC_MODEL') || 'gpt-3.5-turbo';

      if (this.shouldUseAnthropic(model)) {
        return this.chatStreamAnthropic(messages, model, options);
      } else {
        return this.chatStreamOpenAI(messages, model, options);
      }
    } catch (error) {
      this.logger.error('Chat stream failed', error);
      throw error;
    }
  }

  private async *chatStreamOpenAI(messages: ChatMessage[], model: string, options: ChatOptions): AsyncIterable<UnifiedChunk> {
     if (!this.openai) throw new Error('OpenAI client not initialized');
     
     const stream = await this.openai.chat.completions.create({
        model,
        messages,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens,
        stream: true,
      });

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || '';
        if (content) {
            yield { content };
        }
      }
  }

  private async *chatStreamAnthropic(messages: ChatMessage[], model: string, options: ChatOptions): AsyncIterable<UnifiedChunk> {
    if (!this.anthropic) throw new Error('Anthropic client not initialized');

    const systemMessage = messages.find(m => m.role === 'system');
    const userAssistantMessages = messages.filter(m => m.role !== 'system');
    
    const anthropicMessages = userAssistantMessages.map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content
    }));

    const stream = await this.anthropic.messages.create({
        model,
        system: systemMessage?.content,
        messages: anthropicMessages,
        max_tokens: options.maxTokens ?? 4096,
        temperature: options.temperature ?? 0.7,
        stream: true,
    });

    for await (const chunk of stream) {
        if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
            yield { content: chunk.delta.text };
        }
    }
  }
}
