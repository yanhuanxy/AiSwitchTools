import { Test, TestingModule } from '@nestjs/testing';
import { AggregateService } from './aggregate.service';
import { ConfigService } from '@nestjs/config';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { WorkflowEngineService } from '../workflow-engine/workflow-engine.service';
import { LlmService } from '../llm/llm.service';
import { ObservabilityService } from '../observability/observability.service';
import { SmartIntentService } from './smart-intent.service';

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

// We will explicitly set these to null/undefined in specific tests
// but provide a default mock for setup
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

describe('AggregateService Null Checks', () => {
  let service: AggregateService;
  let module: TestingModule;

  beforeEach(async () => {
    jest.clearAllMocks();
    module = await Test.createTestingModule({
      providers: [
        AggregateService,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: CACHE_MANAGER, useValue: mockCacheManager },
        { provide: WorkflowEngineService, useValue: mockWorkflowEngineService },
        { provide: LlmService, useValue: mockLlmService },
        { provide: ObservabilityService, useValue: mockObservabilityService },
        { provide: SmartIntentService, useValue: mockSmartIntentService },
      ],
    }).compile();

    service = module.get<AggregateService>(AggregateService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should handle missing ObservabilityService/e2eLatency gracefully', async () => {
    // 1. Simulate Agent Flow to reach e2eLatency recording
    mockConfigService.get.mockImplementation((key) => {
      if (key === 'FEATURE_AGENT_AGGREGATION') return true;
      if (key === 'INTENT_THRESHOLD') return 0.8;
      return null;
    });

    mockSmartIntentService.resolve.mockResolvedValue({ 
        intent: 'workflow', 
        confidence: 0.9, 
        workflowId: 'wf-1' 
    });
    mockWorkflowEngineService.executeWorkflow.mockResolvedValue('Result');

    // 2. Force observabilityService to be null/invalid via prototype/property hacking or re-creation
    // Since it's private readonly, we cast to any
    (service as any).observabilityService = undefined;

    // 3. Execute
    const result = await service.process({ userId: 'u1', conversationId: 'c1', input: 'test', history: [] });

    // 4. Verify no crash and result is returned
    expect(result).toBe('Result');
    // Note: We can't easily spy on logger without mocking Logger, but we know it didn't throw
  });

  it('should handle missing LlmService in Legacy Flow gracefully', async () => {
    // 1. Simulate Legacy Flow
    mockConfigService.get.mockReturnValue(false); // Legacy mode

    // 2. Force llmService to be undefined
    (service as any).llmService = undefined;

    // 3. Execute
    const result = await service.process({ userId: 'u1', conversationId: 'c1', input: 'test', history: [] });

    // 4. Verify fallback response
    expect(result).toEqual({
      content: "抱歉，系统暂时无法处理您的请求。(Service Unavailable)",
      role: 'assistant',
      type: 'fallback_error'
    });
  });

  it('should handle top-level process errors gracefully', async () => {
     // Force an error in flow
     mockConfigService.get.mockReturnValue(true);
     mockSmartIntentService.resolve.mockRejectedValue(new Error('Unexpected Crash'));

     const result = await service.process({ userId: 'u1', conversationId: 'c1', input: 'test', history: [] });

     expect(result).toEqual({
        content: "抱歉，系统暂时无法处理您的请求。(System Error)",
        role: 'assistant',
        type: 'error'
     });
  });
});
