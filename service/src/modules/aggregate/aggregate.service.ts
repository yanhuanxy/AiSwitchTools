import { Injectable, Logger, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import * as crypto from 'crypto';
import { WorkflowEngineService } from '../workflow-engine/workflow-engine.service';
import { LlmService } from '../llm/llm.service';
import { ObservabilityService } from '../observability/observability.service';
import { SmartIntentService } from './smart-intent.service';
import { ModelConfigService } from '../llm/model-config.service';

// Simple Circuit Breaker Implementation
export class CircuitBreaker {
  private failures = 0;
  private successes = 0;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  private lastFailureTime = 0;
  private readonly threshold = 0.5; // 50% failure rate
  private readonly windowSize = 10; // Check last 10 requests (simplified: just counts)
  private readonly timeout = 30000; // 30s open state

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.timeout) {
        this.state = 'HALF_OPEN';
      } else {
        throw new Error('CircuitBreaker: OPEN');
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess() {
    if (this.state === 'HALF_OPEN') {
      this.state = 'CLOSED';
      this.failures = 0;
      this.successes = 0;
    } else {
      this.successes++;
      this.checkState();
    }
  }

  private onFailure() {
    this.failures++;
    this.lastFailureTime = Date.now();
    if (this.state === 'HALF_OPEN') {
      this.state = 'OPEN';
    } else {
      this.checkState();
    }
  }

  private checkState() {
    const total = this.failures + this.successes;
    if (total >= this.windowSize) {
      const rate = this.failures / total;
      if (rate >= this.threshold) {
        this.state = 'OPEN';
      }
      // Reset window
      this.failures = 0;
      this.successes = 0;
    }
  }
}

@Injectable()
export class AggregateService {
  private readonly logger = new Logger(AggregateService.name);
  private readonly circuitBreaker = new CircuitBreaker();

  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    @Inject(WorkflowEngineService) private readonly workflowEngineService: WorkflowEngineService,
    @Inject(LlmService) private readonly llmService: LlmService,
    @Inject(ObservabilityService) private readonly observabilityService: ObservabilityService,
    @Inject(SmartIntentService) private readonly smartIntentService: SmartIntentService,
    @Inject(ModelConfigService) private readonly modelConfigService: ModelConfigService,
  ) {
    // Defensive checks to ensure all dependencies are injected correctly
    const dependencies = {
      CacheManager: this.cacheManager,
      WorkflowEngineService: this.workflowEngineService,
      LlmService: this.llmService,
      ObservabilityService: this.observabilityService,
      SmartIntentService: this.smartIntentService,
      ModelConfigService: this.modelConfigService,
    };

    const missingDependencies = Object.entries(dependencies)
      .filter(([_, value]) => !value)
      .map(([key]) => key);

    if (missingDependencies.length > 0) {
      const errorMsg = `AggregateService failed to initialize. Missing dependencies: ${missingDependencies.join(', ')}`;
      this.logger.error(errorMsg);
      throw new Error(errorMsg);
    }
    this.logger.log('AggregateService initialized successfully with all dependencies.');
  }

  /**
   * Main entry point for processing user messages.
   * Agent Mode is controlled solely by 'FEATURE_AGENT_AGGREGATION' environment variable.
   * This flag is not affected by database settings or user permissions in this context.
   */
  async process(context: any): Promise<any> {
    // ConfigService is guaranteed to be defined by DI
    const isAgentEnabled = this.modelConfigService.featureAgentAggregation;
    const traceId = this.generateTraceId();
    const startTime = Date.now();
    
    // Defensive check for logger
    if (this.logger) {
      this.logger.log(`[${traceId}] Processing request for conversation ${context?.conversationId || 'unknown'}`);
    } else {
      console.log(`[${traceId}] Processing request for conversation ${context?.conversationId || 'unknown'}`);
    }

    if (!context) {
       const errorMsg = `[${traceId}] Context is undefined or null`;
       if(this.logger) this.logger.error(errorMsg);
       throw new Error('Context is required');
    }

    try {
      let result;
      // If Agent Mode is enabled, use the Triple-Layer Dispatcher
      if (isAgentEnabled) {
        result = await this.processAgentFlow(context, traceId);
      } else {
        // Even in legacy mode, we process it here to ensure consistency,
        // but typically we might just forward it.
        // However, user requested NO legacy_handoff to frontend.
        result = await this.processLegacyFlow(context, traceId);
      }
      
      // Record E2E Latency
      const duration = (Date.now() - startTime) / 1000;
      if (this.observabilityService && this.observabilityService.e2eLatency) {
        this.observabilityService.e2eLatency.observe(duration);
      } else {
        this.logger.warn(`[${traceId}] ObservabilityService or e2eLatency metric not initialized`);
      }
      
      return result;
    } catch (error) {
      if(this.logger) this.logger.error(`[${traceId}] Error processing request`, error);
      // Fallback in case of top-level error in process()
      return {
          content: "抱歉，系统暂时无法处理您的请求。(System Error)",
          role: 'assistant',
          type: 'error'
      };
    }
  }

  async processAgentFlow(context: any, traceId: string): Promise<any> {
    this.logger.log(`[${traceId}] Agent Mode Active - Starting Triple-Layer Dispatch`);
    const { userId, conversationId, input, history } = context;

    // --- L1: Deterministic Command Layer ---
    const commandResult = await this.processL1Command(input, traceId);
    if (commandResult) {
        return commandResult;
    }

    // --- L2: Semantic Intent Layer ---
    // 1. Intent Recognition with Cache
    const cacheKey = this.generateCacheKey(userId, conversationId, input);
    let intentResult = await this.cacheManager.get<{ intent: string; confidence: number; workflowId?: string; graphData?: any }>(cacheKey);

    if (!intentResult) {
      // Use SmartIntentService instead of hardcoded logic
      intentResult = await this.smartIntentService.resolve(input, history);
      await this.cacheManager.set(cacheKey, intentResult, 300000); // 5 min TTL
    }

    this.logger.log(`[${traceId}] Intent detected: ${intentResult.intent} (Confidence: ${intentResult.confidence})`);

    const confidenceThreshold = this.modelConfigService.intentThreshold; // > 0.85

    if ((intentResult.intent === 'workflow' || intentResult.intent === 'dynamic_workflow') && intentResult.confidence >= confidenceThreshold) {
      if (this.observabilityService && this.observabilityService.intentAccuracy) {
        this.observabilityService.intentAccuracy.inc({ status: 'success' });
      }
      
      // 3. Workflow Execution with Circuit Breaker
      try {
        return await this.circuitBreaker.execute(async () => {
          if (intentResult.graphData) {
             this.logger.log(`[${traceId}] Executing Dynamic Workflow`);
             const result = await this.workflowEngineService.executeDynamicWorkflow(intentResult.graphData, { ...context, traceId });
             if (this.observabilityService && this.observabilityService.planningSuccessRate) {
                this.observabilityService.planningSuccessRate.inc({ status: 'success' });
             }
             return result;
          } else if (intentResult.workflowId) {
             this.logger.log(`[${traceId}] Executing Workflow ${intentResult.workflowId}`);
             const result = await this.workflowEngineService.executeWorkflow(intentResult.workflowId, { ...context, traceId });
             if (this.observabilityService && this.observabilityService.planningSuccessRate) {
                this.observabilityService.planningSuccessRate.inc({ status: 'success' });
             }
             return result;
          } else {
             throw new Error('Invalid intent result: missing workflowId or graphData');
          }
        });
      } catch (error) {
        this.logger.warn(`[${traceId}] Workflow execution failed or circuit open. Falling back to L3.`);
        if (this.observabilityService && this.observabilityService.planningSuccessRate) {
            this.observabilityService.planningSuccessRate.inc({ status: 'fail' });
        }
        // Fallback to L3
      }
    } else {
        if (this.observabilityService && this.observabilityService.intentAccuracy) {
            this.observabilityService.intentAccuracy.inc({ status: 'ignored' }); // Low confidence
        }
    }

    // --- L3: Default Chat / Fallback Layer ---
    this.logger.log(`[${traceId}] L3 Fallback: Standard Chat (Low confidence or no workflow)`);
    return await this.processL3Fallback(context, traceId);
  }

  // L1: Command Processing
  private async processL1Command(input: string, traceId: string): Promise<any | null> {
      if (!input) return null;
      
      // Example Commands
      if (input.trim() === '/reset') {
          this.logger.log(`[${traceId}] L1 Command matched: /reset`);
          return {
              content: "会话已重置 (Session Reset)",
              role: 'assistant',
              type: 'command_result'
          };
      }
      
      // Regex Example: #Ticket
      if (/^#\S+/.test(input)) {
           // Example: #订票 -> could be a command shortcut
           // For now just logging
           this.logger.log(`[${traceId}] L1 Command matched pattern: ${input}`);
      }
      
      return null;
  }
  
  // L3: Fallback Chat (Replaces Legacy Handoff)
  private async processL3Fallback(context: any, traceId: string): Promise<any> {
      // Instead of returning 'legacy_handoff', we execute a standard LLM call
      // mimicking what ChatService would have done, but strictly within AggregateService control.
      return this.processLegacyFlow(context, traceId);
  }

  async processLegacyFlow(context: any, traceId: string): Promise<any> {
    this.logger.log(`[${traceId}] Legacy/Fallback Chat Mode`);
    
    try {
        const { input, history } = context;
        
        // LlmService is guaranteed to be defined by DI in the constructor.
        // However, we keep a check for safety in case of partial initialization in tests.
        if (!this.llmService) {
             this.logger.error(`[${traceId}] LlmService not initialized for fallback`);
             throw new Error('LlmService is required for legacy flow');
        }

        // Construct messages for LLM
        const messages = [
            ...(history || []).map((m: any) => ({ role: m.role, content: m.content })),
            { role: 'user', content: input }
        ];

        // Call LLM Service directly
        const modelName = this.modelConfigService.fallbackModel;
        const response = await this.llmService.chatCompletion(messages, {
            model: modelName,
            temperature: 0.7
        });
        
        return {
            content: response,
            role: 'assistant',
            type: 'text'
        };

    } catch (e) {
        this.logger.error(`[${traceId}] L3 Fallback failed`, e);
        return {
             content: "抱歉，系统暂时无法处理您的请求。(Fallback failed)",
             role: 'assistant',
             type: 'error'
        };
    }
  }

  private generateTraceId(): string {
    const appName = 'AiSwitch';
    const date = new Date().toISOString().replace(/[-T:]/g, '').slice(0, 14); // yyyyMMddHHmmss
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `${appName}-${date}-${random}`;
  }

  private generateCacheKey(userId: string, sessionId: string, query: string): string {
    const hash = crypto.createHash('md5').update(`${userId}:${sessionId}:${query}`).digest('hex');
    return `intent:${hash}`;
  }
}
