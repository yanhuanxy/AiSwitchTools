import { Test, TestingModule } from '@nestjs/testing';
import { AggregateService } from './aggregate.service';
import { ConfigService } from '@nestjs/config';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { WorkflowEngineService } from '../workflow-engine/workflow-engine.service';
import { LlmService } from '../llm/llm.service';
import { ObservabilityService } from '../observability/observability.service';
import { SmartIntentService } from './smart-intent.service';
import { ModelConfigService } from '../llm/model-config.service';

const mockConfigService = {
  get: jest.fn(),
};

const mockCacheManager = {
  get: jest.fn(),
  set: jest.fn(),
};

const mockWorkflowEngineService = {
  executeWorkflow: jest.fn(),
  executeDynamicWorkflow: jest.fn(),
};

const mockLlmService = {
  chatCompletion: jest.fn(),
};

const mockObservabilityService = {
  intentAccuracy: { inc: jest.fn() },
  planningSuccessRate: { inc: jest.fn() },
  e2eLatency: { observe: jest.fn() },
};

const mockSmartIntentService = {
  resolve: jest.fn(),
};

const mockModelConfigService = {
  embeddingModel: 'text-embedding-mock',
  defaultChatModel: 'gpt-mock',
  semanticAnalysisModel: 'gpt-mock',
  fallbackModel: 'gpt-mock',
};

describe('AggregateService', () => {
  let service: AggregateService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AggregateService,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: CACHE_MANAGER, useValue: mockCacheManager },
        { provide: WorkflowEngineService, useValue: mockWorkflowEngineService },
        { provide: LlmService, useValue: mockLlmService },
        { provide: ObservabilityService, useValue: mockObservabilityService },
        { provide: SmartIntentService, useValue: mockSmartIntentService },
        { provide: ModelConfigService, useValue: mockModelConfigService },
      ],
    }).compile();

    service = module.get<AggregateService>(AggregateService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('process', () => {
    it('should throw error if context is missing', async () => {
      await expect(service.process(null)).rejects.toThrow('Context is required');
    });

    it('should use legacy/fallback flow if feature flag is disabled', async () => {
      mockConfigService.get.mockReturnValue(false); // FEATURE_AGENT_AGGREGATION = false
      mockLlmService.chatCompletion.mockResolvedValue('Legacy Reply');

      const context = { conversationId: '123', input: 'hello', history: [] };
      const result = await service.process(context);
      
      expect(mockLlmService.chatCompletion).toHaveBeenCalled();
      expect(result).toEqual({ 
          content: 'Legacy Reply',
          role: 'assistant',
          type: 'text'
      });
    });

    it('should use configured model for legacy fallback', async () => {
      mockConfigService.get.mockImplementation((key, def) => {
        if (key === 'FEATURE_AGENT_AGGREGATION') return false;
        return def;
      });
      // Mock modelConfigService fallback model
      mockModelConfigService.fallbackModel = 'gpt-4-turbo';
      
      mockLlmService.chatCompletion.mockResolvedValue('GPT-4 Reply');

      const context = { conversationId: '123', input: 'test model', history: [] };
      await service.process(context);
      
      expect(mockLlmService.chatCompletion).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ model: 'gpt-4-turbo' })
      );
    });

    it('should use agent flow if feature flag is enabled', async () => {
      mockConfigService.get.mockImplementation((key, def) => {
        if (key === 'FEATURE_AGENT_AGGREGATION') return true;
        if (key === 'INTENT_THRESHOLD') return 0.8;
        return def;
      });

      // Mock Cache Miss
      mockCacheManager.get.mockResolvedValue(null);

      // Mock Smart Intent
      mockSmartIntentService.resolve.mockResolvedValue({ 
          intent: 'workflow', 
          confidence: 0.9, 
          workflowId: 'wf-1' 
      });

      // Mock Workflow Execution
      mockWorkflowEngineService.executeWorkflow.mockResolvedValue('Workflow Result');

      const context = { userId: 'u1', conversationId: 'c1', input: 'run workflow', history: [] };
      const result = await service.process(context);

      expect(result).toBe('Workflow Result');
      expect(mockCacheManager.set).toHaveBeenCalled();
      expect(mockWorkflowEngineService.executeWorkflow).toHaveBeenCalled();
      expect(mockObservabilityService.intentAccuracy.inc).toHaveBeenCalledWith({ status: 'success' });
    });

    it('should execute dynamic workflow', async () => {
      mockConfigService.get.mockImplementation((key, def) => {
        if (key === 'FEATURE_AGENT_AGGREGATION') return true;
        if (key === 'INTENT_THRESHOLD') return 0.8;
        return def;
      });

      mockCacheManager.get.mockResolvedValue(null);
      
      // Mock Dynamic Intent
      mockSmartIntentService.resolve.mockResolvedValue({
        intent: 'dynamic_workflow',
        confidence: 0.85,
        workflowId: 'temp-123',
        graphData: { nodes: [], edges: [] }
      });

      mockWorkflowEngineService.executeDynamicWorkflow.mockResolvedValue('Dynamic Result');

      const context = { userId: 'u1', conversationId: 'c1', input: 'do something dynamic', history: [] };
      const result = await service.process(context);

      expect(result).toBe('Dynamic Result');
      expect(mockWorkflowEngineService.executeDynamicWorkflow).toHaveBeenCalled();
    });

    it('should fallback to legacy if intent confidence is low', async () => {
      mockConfigService.get.mockImplementation((key, def) => {
        if (key === 'FEATURE_AGENT_AGGREGATION') return true;
        if (key === 'INTENT_THRESHOLD') return 0.8;
        return def;
      });

      mockCacheManager.get.mockResolvedValue(null);
      
      // Low confidence intent
      mockSmartIntentService.resolve.mockResolvedValue({ 
          intent: 'unknown', 
          confidence: 0.5 
      });

      mockLlmService.chatCompletion.mockResolvedValue('Fallback Reply');

      const context = { userId: 'u1', conversationId: 'c1', input: 'unknown query', history: [] };
      const result = await service.process(context);

      expect(mockLlmService.chatCompletion).toHaveBeenCalled();
      expect(result).toEqual({ 
          content: 'Fallback Reply',
          role: 'assistant',
          type: 'text'
      });
      expect(mockObservabilityService.intentAccuracy.inc).toHaveBeenCalledWith({ status: 'ignored' });
    });
  });
});
