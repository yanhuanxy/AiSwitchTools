
import {Inject, Injectable, Logger, Optional} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface ModelConfig {
  llmType: string,
  baseUrl: string;
  authToken: string;
  localEmbeddingType: string;
  localEmbeddingUrl: string;
  localEmbeddingTimeout: number;
  localEmbeddingRetries: number;
  embeddingModel: string;
  semanticAnalysisModel: string;
  fallbackModel: string;
  defaultChatModel: string;
  summaryModel: string;
  summaryMaxTokens: number;
  summaryMinTokens: number;
  summaryMinMessages: number;
  summaryCustomPatterns: any;
  summaryStaleHours: number;
  summaryAutoGeneration: boolean;
  featureAgentAggregation: boolean;
  intentThreshold: number;
}

@Injectable()
export class ModelConfigService {
  private readonly logger = new Logger(ModelConfigService.name);
  private config!: ModelConfig;

  constructor(@Optional() @Inject(ConfigService) private readonly configService: ConfigService) {
    this.loadConfig();
  }

  private loadConfig() {
    const llmType = this.configService.get<string>('LLM_TYPE', '')

    const localEmbeddingType = this.configService.get<string>('LOCAL_EMBEDDING_TYPE', '');
    const localEmbeddingUrl = this.configService.get<string>('LOCAL_EMBEDDING_URL', '');
    const localEmbeddingTimeout = this.configService.get<number>('LOCAL_EMBEDDING_TIMEOUT', 5000);
    const localEmbeddingRetries = this.configService.get<number>('LOCAL_EMBEDDING_RETRIES', 3);
    if(llmType === 'Anthropic'){
      this.config = {
        llmType: llmType,
        baseUrl: this.configService.get<string>('ANTHROPIC_BASE_URL', ''),
        authToken: this.configService.get<string>('ANTHROPIC_AUTH_TOKEN', ''),
        localEmbeddingType: localEmbeddingType,
        localEmbeddingUrl: localEmbeddingUrl,
        localEmbeddingTimeout: localEmbeddingTimeout,
        localEmbeddingRetries: localEmbeddingRetries,
        embeddingModel: this.configService.get<string>('EMBEDDING_MODEL', 'text-embedding-ada-002'),
        semanticAnalysisModel: this.configService.get<string>('SEMANTIC_ANALYSIS_MODEL', ''),
        fallbackModel: this.configService.get<string>('FALLBACK_LLM_MODEL', ''),
        defaultChatModel: this.configService.get<string>('ANTHROPIC_SMALL_FAST_MODEL', ''),
        summaryModel: this.configService.get<string>('ANTHROPIC_MODEL', ''),
        summaryMaxTokens: this.configService.get<number>('ANTHROPIC_MAX_TOKENS', 0),
        summaryMinTokens: this.configService.get<number>('ANTHROPIC_MIN_TOKENS', 0),
        summaryMinMessages: this.configService.get<any>('ANTHROPIC_MIN_MESSAGES', 0),
        summaryCustomPatterns: this.configService.get<any>('ANTHROPIC_CUSTOM_PATTERNS', []),
        summaryStaleHours: this.configService.get<any>('ANTHROPIC_STALE_HOURS', 0),
        summaryAutoGeneration: this.configService.get<any>('ANTHROPIC_AUTO_GENERATION', false),
        featureAgentAggregation: this.configService.get<any>('ANTHROPIC_AUTO_GENERATION', false),
        intentThreshold: this.configService.get<any>('INTENT_THRESHOLD', 0.85),
      };
    }else {
      this.config = {
        llmType: llmType,
        baseUrl: this.configService.get<string>('OPENAI_BASE_URL', ''),
        authToken: this.configService.get<string>('OPENAI_API_KEY', ''),
        localEmbeddingType: localEmbeddingType,
        localEmbeddingUrl: localEmbeddingUrl,
        localEmbeddingTimeout: localEmbeddingTimeout,
        localEmbeddingRetries: localEmbeddingRetries,
        embeddingModel: this.configService.get<string>('EMBEDDING_MODEL', 'text-embedding-ada-002'),
        semanticAnalysisModel: this.configService.get<string>('SEMANTIC_ANALYSIS_MODEL', ''),
        fallbackModel: this.configService.get<string>('FALLBACK_LLM_MODEL', ''),
        defaultChatModel: this.configService.get<string>('CHAT_DEFAULT_MODEL', ''),
        summaryModel: this.configService.get<string>('SUMMARY_MODEL', ''),
        summaryMaxTokens: this.configService.get<number>('SUMMARY_MAX_TOKENS', 0),
        summaryMinTokens: this.configService.get<number>('SUMMARY_MIN_TOKENS', 0),
        summaryMinMessages: this.configService.get<any>('SUMMARY_MIN_MESSAGES', 0),
        summaryCustomPatterns: this.configService.get<any>('SUMMARY_CUSTOM_PATTERNS', []),
        summaryStaleHours: this.configService.get<any>('SUMMARY_STALE_HOURS', 0),
        summaryAutoGeneration: this.configService.get<any>('SUMMARY_AUTO_GENERATION', 0),
        featureAgentAggregation: this.configService.get<any>('FEATURE_AGENT_AGGREGATION', false),
        intentThreshold: this.configService.get<any>('INTENT_THRESHOLD', 0.85),
      };
    }

    this.validateConfig();
  }

  private validateConfig() {
    const missing = Object.entries(this.config)
      .filter(([_, value]) => !value)
      .map(([key]) => key);

    if (missing.length > 0) {
      this.logger.warn(`Missing model configurations: ${missing.join(', ')}. Using hardcoded defaults may cause issues.`);
    } else {
      this.logger.log('Model configuration loaded successfully:', this.config);
    }
  }

  get llmType(): string {
    return this.config.llmType;
  }

  get baseUrl(): string {
    return this.config.baseUrl;
  }

  get authToken(): string {
    return this.config.authToken;
  }

  get localEmbeddingType(): string {
    return this.config.localEmbeddingType;
  }

  get localEmbeddingUrl(): string {
    return this.config.localEmbeddingUrl;
  }

  get localEmbeddingTimeout(): number {
    return this.config.localEmbeddingTimeout;
  }

  get localEmbeddingRetries(): number {
    return this.config.localEmbeddingRetries;
  }

  get embeddingModel(): string {
    return this.config.embeddingModel;
  }

  get embeddingDimension(): number {
    if (this.localEmbeddingType === 'in-process') {
      // Xenova/all-MiniLM-L6-v2 is 384 dimensions
      return 384;
    }
    // Default to OpenAI text-embedding-ada-002 dimension
    return 1536;
  }

  get semanticAnalysisModel(): string {
    return this.config.semanticAnalysisModel;
  }

  get fallbackModel(): string {
    return this.config.fallbackModel;
  }

  get defaultChatModel(): string {
    return this.config.defaultChatModel;
  }

  get summaryModel(): string {
    return this.config.summaryModel;
  }

  get summaryMaxTokens(): number {
    return this.config.summaryMaxTokens;
  }

  get summaryMinTokens(): number {
    return this.config.summaryMinTokens;
  }

  get summaryCustomPatterns(): any {
    return this.config.summaryCustomPatterns;
  }

  get summaryMinMessages(): number {
    return this.config.summaryMinMessages;
  }

  get summaryStaleHours(): number {
    return this.config.summaryStaleHours;
  }

  get summaryAutoGeneration(): boolean {
    return this.config.summaryAutoGeneration;
  }

  get featureAgentAggregation(): boolean {
    return this.config.featureAgentAggregation;
  }

  get intentThreshold(): number {
    return this.config.intentThreshold;
  }

  reload() {
    this.logger.log('Reloading model configuration...');
    this.loadConfig();
  }
}
