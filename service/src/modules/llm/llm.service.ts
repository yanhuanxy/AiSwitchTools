import { Injectable, Logger, Inject, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { PrismaService } from '../../prisma/prisma.service';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { ModelConfigService } from './model-config.service';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | Array<any>;
}

export interface ChatOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}

export interface UnifiedChunk {
  content: string;
}

export interface ModelInfo {
  provider: string;
  modelName: string;
  displayName: string;
  enabled: boolean;
}

// Use type-only import for LocalVectorService if possible, or ensure it is mocked in tests
import { LocalVectorService } from './local-vector.service';

@Injectable()
export class LlmService {
  private openai: OpenAI | null = null;
  private anthropic: Anthropic | null = null;
  private readonly logger = new Logger(LlmService.name);
  private readonly CACHE_KEY = 'llm:available_models';

  constructor(
    @Inject(ConfigService) private readonly configService: ConfigService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    @Inject(PrismaService) private prisma: PrismaService,
    @Inject(ModelConfigService) private readonly modelConfigService: ModelConfigService,
    @Inject(LocalVectorService) private readonly localVectorService: LocalVectorService,
  ) {
    this.initClients();
  }

  private initClients() {
    // OpenAI Init - Always attempt to initialize for Embeddings or fallback
    // Anthropic Init
    const llmType = this.modelConfigService.llmType;
    if(llmType == "openAi"){
        this.openai = new OpenAI({
            apiKey: this.modelConfigService.authToken,
            baseURL: this.modelConfigService.baseUrl,
        });
        this.logger.log('OpenAI client initialized');
    }else if(llmType === 'Anthropic'){
        this.anthropic = new Anthropic({
            apiKey: this.modelConfigService.authToken,
            baseURL: this.modelConfigService.baseUrl,
        });
        this.logger.log('Anthropic client initialized');
    }

    if (!this.openai && !this.anthropic) {
      this.logger.warn('No LLM client initialized (missing keys)');
    }
  }

  private shouldUseAnthropic(model: string): boolean {
    const anthropicModel = this.configService.get('ANTHROPIC_MODEL');
    if (anthropicModel && model === anthropicModel) return true;

    if (model.startsWith('claude-') || model.startsWith('kimi-')) {
       return !!this.anthropic;
    }
    
    if (!this.openai && this.anthropic) return true;

    return false;
  }

  async getAvailableModels(): Promise<{ models: ModelInfo[] }> {
    // 1. Try Cache
    const cached = await this.cacheManager.get<{ models: ModelInfo[] }>(this.CACHE_KEY);
    if (cached) {
      return cached;
    }

    const modelsMap = new Map<string, ModelInfo>();

    // 2. Fetch from DB
    try {
      const dbModels = await this.prisma.aiModel.findMany({
        where: { enabled: true, deprecated: false },
      });
      
      for (const m of dbModels) {
        const key = `${m.provider}:${m.modelId}`;
        modelsMap.set(key, {
          provider: m.provider,
          modelName: m.modelId,
          displayName: m.name,
          enabled: m.enabled
        });
      }
    } catch (e) {
      this.logger.error('Failed to fetch models from DB', e);
    }

    // 3. Fallback to Env
    const envModelsStr = this.configService.get<string>('AVAILABLE_MODELS');
    if (envModelsStr) {
      const envModels = envModelsStr.split(',').map(s => s.trim()).filter(Boolean);
      for (const entry of envModels) {
        const [provider, modelName] = entry.split(':');
        if (provider && modelName) {
          const key = `${provider}:${modelName}`;
          if (!modelsMap.has(key)) {
             modelsMap.set(key, {
               provider,
               modelName,
               displayName: modelName, // Default display name
               enabled: true
             });
          }
        }
      }
    }

    // 4. Default Fallback (Configured defaults)
    if (modelsMap.size === 0) {
       // Check if we have clients and add basic ones
       const defaultChatModel = this.modelConfigService.defaultChatModel;
       if (this.openai) {
         modelsMap.set(`openai:${defaultChatModel}`, { provider: 'openai', modelName: defaultChatModel, displayName: 'Default Chat Model', enabled: true });
       }
       if (this.anthropic) {
         modelsMap.set(`anthropic:${defaultChatModel}`, { provider: 'anthropic', modelName: defaultChatModel, displayName: 'Default Anthropic Model', enabled: true });
       }
    }

    if (modelsMap.size === 0) {
      throw new HttpException({
        code: 503003,
        message: 'No available model configuration'
      }, HttpStatus.SERVICE_UNAVAILABLE);
    }

    const result = { models: Array.from(modelsMap.values()) };
    
    // 5. Cache Result
    await this.cacheManager.set(this.CACHE_KEY, result);

    return result;
  }

  async reloadCache() {
    this.modelConfigService.reload(); // Also reload config
    await this.cacheManager.del(this.CACHE_KEY);
    return this.getAvailableModels();
  }

  // ... keep other methods ...

  async getEmbedding(text: string): Promise<number[]> {
    // 1. Try Local Vector Service (Priority)
    // You can control this via config if you want to toggle it, but here we try it first if configured
    try {
        // Simple check if we should prefer local - or just try it.
        // For robustness, we can try local first, then fallback to OpenAI, then Mock.
        return await this.localVectorService.getEmbedding(text);
    } catch (localErr) {
        this.logger.warn(`Local embedding failed, falling back to OpenAI: ${localErr}`);
    }

    // 2. Try OpenAI
    if (this.openai) {
      try {
        const response = await this.openai.embeddings.create({
          model: this.modelConfigService.embeddingModel, 
          input: text,
        });
        return response.data[0].embedding;
      } catch (err) {
        this.logger.error('OpenAI Embedding failed', err);
      }
    }
    throw new Error('Embedding failed');
  }

  async getEmbeddings(texts: string[]): Promise<number[][]> {
      // 1. Try Local Vector Service
      try {
          return await this.localVectorService.getEmbeddings(texts);
      } catch (localErr) {
          this.logger.warn(`Local batch embedding failed, falling back to OpenAI: ${localErr}`);
      }

      // 2. Try OpenAI
      if (this.openai) {
          try {
              const response = await this.openai.embeddings.create({
                  model: this.modelConfigService.embeddingModel,
                  input: texts,
              });
              return response.data.map(d => d.embedding);
          } catch (err) {
              this.logger.error('OpenAI Batch Embedding failed', err);
          }
      }

      // 3. Mock Fallback
      this.logger.warn('Using Mock Batch Embedding');
      return texts.map(() => Array.from({ length: 1536 }, () => Math.random()));
  }

  async chatCompletion(
    messages: ChatMessage[],
    options: ChatOptions = {},
  ): Promise<string> {
    try {
      let model = options.model || this.modelConfigService.defaultChatModel;
      
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
    
    const formattedMessages = messages.map(m => {
        if (typeof m.content === 'string') return m as any;
        return {
            role: m.role,
            content: m.content.map(c => {
                if (c.type === 'text') return { type: 'text', text: c.text };
                if (c.type === 'image_url') return { type: 'image_url', image_url: c.image_url };
                return c;
            })
        };
    });

    const response = await this.openai.chat.completions.create({
        model,
        messages: formattedMessages,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens,
        stream: false,
    });
    return response.choices[0]?.message?.content || '';
  }

  private async chatCompletionAnthropic(messages: ChatMessage[], model: string, options: ChatOptions): Promise<string> {
    if (!this.anthropic) throw new Error('Anthropic client not initialized');

    // Convert messages to Anthropic format
    const systemMessage = messages.find(m => m.role === 'system');
    const userAssistantMessages = messages.filter(m => m.role !== 'system');
    
    const anthropicMessages = userAssistantMessages.map(m => {
        if (typeof m.content === 'string') {
            return {
                role: m.role as 'user' | 'assistant',
                content: m.content
            };
        }
        
        // Handle multimodal content
        return {
            role: m.role as 'user' | 'assistant',
            content: m.content.map(c => {
                if (c.type === 'text') return { type: 'text', text: c.text };
                if (c.type === 'image_url') {
                    // OpenAI format uses image_url: { url: "data:image/jpeg;base64,..." }
                    // We need to parse this for Anthropic: { type: "image", source: { type: "base64", media_type: "...", data: "..." } }
                    const url = c.image_url.url;
                    if (url.startsWith('data:')) {
                        const [header, base64] = url.split(',');
                        const mediaType = header.match(/data:(.*);base64/)?.[1] || 'image/jpeg';
                        return {
                            type: 'image',
                            source: {
                                type: 'base64',
                                media_type: mediaType as any,
                                data: base64
                            }
                        };
                    }
                    // If it's a remote URL, Anthropic might not support it directly in this SDK version or requires fetching.
                    // For now, assume base64.
                    return { type: 'text', text: '[Image URL not supported in Anthropic yet]' };
                }
                return c;
            })
        };
    });

    const response = await this.anthropic.messages.create({
        model,
        system: typeof systemMessage?.content === 'string' ? systemMessage.content : undefined,
        messages: anthropicMessages as any,
        max_tokens: options.maxTokens ?? 4096,
        temperature: options.temperature ?? 0.7,
        stream: false,
    });

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
      let model = options.model || this.modelConfigService.defaultChatModel;

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
