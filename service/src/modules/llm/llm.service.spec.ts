
import { Test, TestingModule } from '@nestjs/testing';
import { LlmService, ModelInfo } from './llm.service';
import { ConfigService } from '@nestjs/config';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { PrismaService } from '../../prisma/prisma.service';
import { HttpException } from '@nestjs/common';
import { ModelConfigService } from './model-config.service';
import { LocalVectorService } from './local-vector.service';

// Mock the TransformersVectorService module entirely to avoid import side effects
jest.mock('./transformers-vector.service', () => {
  return {
    TransformersVectorService: jest.fn().mockImplementation(() => ({
      getEmbedding: jest.fn(),
      getEmbeddings: jest.fn(),
      isAvailable: jest.fn().mockResolvedValue(true),
    })),
  };
});

// Mock LocalVectorService but we also need to mock its dependencies or implementation
// Since we are testing LlmService, we should mock LocalVectorService entirely
jest.mock('./local-vector.service', () => {
  return {
    LocalVectorService: jest.fn().mockImplementation(() => ({
      getEmbedding: jest.fn(),
      getEmbeddings: jest.fn(),
      isAvailable: jest.fn().mockResolvedValue(true),
    })),
  };
});

// Mocks for OpenAI and Anthropic
const mockOpenAICreate = jest.fn();
const mockOpenAIEmbeddings = jest.fn();


jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => ({
    chat: { completions: { create: mockOpenAICreate } },
    embeddings: { create: mockOpenAIEmbeddings },
  }));
});

jest.mock('@anthropic-ai/sdk', () => {
  return jest.fn().mockImplementation(() => ({
    messages: { create: jest.fn() },
  }));
});

const mockConfigService = {
  get: jest.fn(),
};

const mockCacheManager = {
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
};

const mockPrismaService = {
  aiModel: {
    findMany: jest.fn(),
  },
};

const mockModelConfigService = {
  embeddingModel: 'text-embedding-mock',
  defaultChatModel: 'gpt-mock',
  semanticAnalysisModel: 'gpt-mock',
  fallbackModel: 'gpt-mock',
  openaiApiKey: undefined,
  authToken: 'test-token',
  reload: jest.fn(),
};

const mockLocalVectorService = {
  getEmbedding: jest.fn(),
  getEmbeddings: jest.fn(),
  isAvailable: jest.fn(),
};

describe('LlmService', () => {
  let service: LlmService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LlmService,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: CACHE_MANAGER, useValue: mockCacheManager },
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: ModelConfigService, useValue: mockModelConfigService },
        { provide: LocalVectorService, useValue: mockLocalVectorService },
      ],
    }).compile();

    service = module.get<LlmService>(LlmService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getAvailableModels', () => {
    it('should return cached models if available', async () => {
      const cachedModels = { models: [{ provider: 'test', modelName: 'test', displayName: 'Test', enabled: true }] };
      mockCacheManager.get.mockResolvedValue(cachedModels);

      const result = await service.getAvailableModels();
      expect(result).toEqual(cachedModels);
      expect(mockPrismaService.aiModel.findMany).not.toHaveBeenCalled();
    });

    it('should fetch from DB and Env, prioritize DB, and cache result', async () => {
      mockCacheManager.get.mockResolvedValue(null);
      
      // DB Models
      mockPrismaService.aiModel.findMany.mockResolvedValue([
        { provider: 'db', modelId: 'm1', name: 'DB Model 1', enabled: true, deprecated: false },
        { provider: 'db', modelId: 'm2', name: 'DB Model 2', enabled: true, deprecated: false },
      ]);

      // Env Models (one duplicate with DB, one new)
      // Format: provider:modelName
      mockConfigService.get.mockImplementation((key) => {
        if (key === 'AVAILABLE_MODELS') return 'db:m1, env:m3';
        return null;
      });

      const result = await service.getAvailableModels();

      expect(result.models).toHaveLength(3);
      
      // Verify DB override (DB Model 1 name should be used)
      const m1 = result.models.find(m => m.provider === 'db' && m.modelName === 'm1');
      expect(m1?.displayName).toBe('DB Model 1');

      // Verify Env
      const m3 = result.models.find(m => m.provider === 'env' && m.modelName === 'm3');
      expect(m3?.displayName).toBe('m3');

      // Verify Cache Set
      expect(mockCacheManager.set).toHaveBeenCalledWith('llm:available_models', result);
    });

    it('should throw 503 if no models found', async () => {
      mockCacheManager.get.mockResolvedValue(null);
      mockPrismaService.aiModel.findMany.mockResolvedValue([]);
      mockConfigService.get.mockReturnValue(null);
      
      // Also ensure no default clients (openai/anthropic) are init in mock
      // Since we mocked ConfigService get returning null for keys, clients won't init.

      await expect(service.getAvailableModels()).rejects.toThrow(HttpException);
    });
  });

  describe('getEmbedding', () => {
    it('should prefer Local Vector Service if successful', async () => {
        const localEmbedding = [0.9, 0.9, 0.9];
        mockLocalVectorService.getEmbedding.mockResolvedValue(localEmbedding);

        const result = await service.getEmbedding('test');

        expect(result).toEqual(localEmbedding);
        expect(mockLocalVectorService.getEmbedding).toHaveBeenCalledWith('test');
        expect(mockOpenAIEmbeddings).not.toHaveBeenCalled();
    });

    it('should fallback to OpenAI if Local Vector Service fails', async () => {
        mockLocalVectorService.getEmbedding.mockRejectedValue(new Error('Local fail'));
        
        // Setup OpenAI
        (mockModelConfigService as any).openaiApiKey = 'sk-test';
        mockConfigService.get.mockImplementation((key) => key === 'LLM_TYPE' ? 'Anthropic' : null);
        
        // Re-compile to init openai
        const module: TestingModule = await Test.createTestingModule({
            providers: [
              LlmService,
              { provide: ConfigService, useValue: mockConfigService },
              { provide: CACHE_MANAGER, useValue: mockCacheManager },
              { provide: PrismaService, useValue: mockPrismaService },
              { provide: ModelConfigService, useValue: mockModelConfigService },
              { provide: LocalVectorService, useValue: mockLocalVectorService },
            ],
          }).compile();
        const localService = module.get<LlmService>(LlmService);

        mockOpenAIEmbeddings.mockResolvedValue({
            data: [{ embedding: [0.1, 0.1, 0.1] }]
        });

        const result = await localService.getEmbedding('test');
        expect(result).toEqual([0.1, 0.1, 0.1]);
        expect(mockLocalVectorService.getEmbedding).toHaveBeenCalled();
        expect(mockOpenAIEmbeddings).toHaveBeenCalled();
    });

    it('should use OpenAI for embeddings even when LLM_TYPE is Anthropic, if OpenAI key is provided (and Local fails/mocked)', async () => {
      // Force Local to fail
      mockLocalVectorService.getEmbedding.mockRejectedValue(new Error('Local not available'));

      // 1. Setup Config for Anthropic Mode but with OpenAI Key
      mockConfigService.get.mockImplementation((key) => {
        if (key === 'LLM_TYPE') return 'Anthropic';
        return null;
      });
      
      // Update mockModelConfigService properties
      (mockModelConfigService as any).openaiApiKey = 'sk-openai-test';
      (mockModelConfigService as any).authToken = 'sk-ant-test'; // Anthropic Token

      // 2. Re-init Service
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          LlmService,
          { provide: ConfigService, useValue: mockConfigService },
          { provide: CACHE_MANAGER, useValue: mockCacheManager },
          { provide: PrismaService, useValue: mockPrismaService },
          { provide: ModelConfigService, useValue: mockModelConfigService },
          { provide: LocalVectorService, useValue: mockLocalVectorService },
        ],
      }).compile();
      const localService = module.get<LlmService>(LlmService);

      // 3. Mock OpenAI Response
      mockOpenAIEmbeddings.mockResolvedValue({
        data: [{ embedding: [0.1, 0.2, 0.3] }]
      });

      // 4. Call getEmbedding
      const embedding = await localService.getEmbedding('test text');

      // 5. Verify
      expect(embedding).toEqual([0.1, 0.2, 0.3]);
      expect(mockOpenAIEmbeddings).toHaveBeenCalledWith({
        model: 'text-embedding-mock',
        input: 'test text',
      });
    });

    it('should return random vector fallback if no OpenAI client and Local fails', async () => {
      mockLocalVectorService.getEmbedding.mockRejectedValue(new Error('Local not available'));
      // 1. Setup Config for Anthropic Mode WITHOUT OpenAI Key
      mockConfigService.get.mockImplementation((key) => {
        if (key === 'LLM_TYPE') return 'Anthropic';
        return null;
      });
      
      (mockModelConfigService as any).openaiApiKey = undefined;
      (mockModelConfigService as any).authToken = 'sk-ant-test';

      // 2. Re-init Service
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          LlmService,
          { provide: ConfigService, useValue: mockConfigService },
          { provide: CACHE_MANAGER, useValue: mockCacheManager },
          { provide: PrismaService, useValue: mockPrismaService },
          { provide: ModelConfigService, useValue: mockModelConfigService },
          { provide: LocalVectorService, useValue: mockLocalVectorService },
        ],
      }).compile();
      const localService = module.get<LlmService>(LlmService);

      // 3. Call getEmbedding
      const embedding = await localService.getEmbedding('test text');

      // 4. Verify (Fallback is random array of length 1536)
      expect(embedding).toHaveLength(1536);
      expect(mockOpenAIEmbeddings).not.toHaveBeenCalled(); // Should clear mocks before this test if reusing
    });
  });
});
