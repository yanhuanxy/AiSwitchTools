
import { Test, TestingModule } from '@nestjs/testing';
import { LlmService, ModelInfo } from './llm.service';
import { ConfigService } from '@nestjs/config';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { PrismaService } from '../../prisma/prisma.service';
import { HttpException } from '@nestjs/common';

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
});
